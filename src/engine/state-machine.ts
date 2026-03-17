import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLogger } from '../logger.js';
import { AssessmentTreeSchema } from '../types/decision-tree.js';
import type {
  AssessmentTree,
  AssessmentNodeMap,
  QuestionNode,
  MovementTestNode,
  Recommendation,
  TreeNode,
} from '../types/decision-tree.js';
import type { ExtractedEntities } from '../types/entities.js';
import type { ConversationMessage } from '../types/messages.js';
import type { LLMAdapter } from './llm-adapter.js';
import { traverseTree, getAvailableActivities } from './traversal.js';

const log = createLogger('state-machine');

// --- Tree loading (preserved) ---

const TREE_ROOT = path.join(path.resolve('src'), 'decision-tree');
const treeCache = new Map<string, AssessmentTree>();

const parseJsonFile = (filePath: string): unknown => {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const cleaned = raw.startsWith('```') ? raw.replace(/^```\w*\s*/u, '').replace(/```\s*$/u, '') : raw;
  return JSON.parse(cleaned);
};

const hydrateNodeWithSource = (node: TreeNode, baseDir: string): TreeNode => {
  if (!node.source) return node;
  const externalPath = path.resolve(baseDir, node.source);
  const externalNode = parseJsonFile(externalPath) as Record<string, unknown>;
  const { source: _discard, ...rest } = node;
  const merged = {
    ...externalNode,
    ...rest,
    next: rest.type === 'assessment' ? undefined : (rest as QuestionNode | MovementTestNode).next ?? (externalNode as Record<string, unknown>).next,
  } as TreeNode;
  return merged;
};

export const loadTree = (version: string): AssessmentTree => {
  if (treeCache.has(version)) return treeCache.get(version)!;

  const treePath = path.join(TREE_ROOT, `${version}.json`);
  const baseDir = path.dirname(treePath);
  const raw = parseJsonFile(treePath);
  const tree = AssessmentTreeSchema.parse(raw);

  const nodes: AssessmentNodeMap = {};
  for (const node of Object.values(tree.nodes)) {
    const hydrated = hydrateNodeWithSource(node, baseDir);
    nodes[hydrated.id] = hydrated;
  }

  const hydratedTree: AssessmentTree = { ...tree, nodes };
  if (!hydratedTree.nodes[hydratedTree.entry_node_id]) {
    throw new Error(`Entry node ${hydratedTree.entry_node_id} not found in tree ${hydratedTree.id}`);
  }

  treeCache.set(version, hydratedTree);
  return hydratedTree;
};

// --- Assessment session state ---

export type AssessmentStatus =
  | 'gathering'
  | 'recommending'
  | 'no_coverage'
  | 'escalated'
  | 'closed';

export interface AssessmentState {
  sessionId: string;
  treeVersion: string;
  entities: ExtractedEntities;
  resolvedEntities: ExtractedEntities;
  currentNodePath: string[];
  modifications: Recommendation[];
  servedModifications: number;
  modificationRatings: number[];
  consecutiveLowRatings: number;
  status: AssessmentStatus;
}

export interface ProcessResult {
  reply: string;
  state: AssessmentState;
  modification?: Recommendation;
}

const NULL_ENTITIES: ExtractedEntities = {
  symptom_side: null,
  triggering_activity: null,
  symptom_location: null,
  symptom_description: null,
};

const REQUIRED_ENTITIES: (keyof ExtractedEntities)[] = [
  'triggering_activity',
  'symptom_location',
];

const sessionStore = new Map<string, AssessmentState>();

// --- Session management ---

export function createSession(treeVersion: string): AssessmentState {
  const sessionId = crypto.randomUUID();
  const state: AssessmentState = {
    sessionId,
    treeVersion,
    entities: { ...NULL_ENTITIES },
    resolvedEntities: { ...NULL_ENTITIES },
    currentNodePath: [],
    modifications: [],
    servedModifications: 0,
    modificationRatings: [],
    consecutiveLowRatings: 0,
    status: 'gathering',
  };
  sessionStore.set(sessionId, state);
  return state;
}

export function getSession(sessionId: string): AssessmentState | undefined {
  return sessionStore.get(sessionId);
}

function saveSession(state: AssessmentState): void {
  sessionStore.set(state.sessionId, state);
}

// --- Entity merging ---

function mergeEntities(existing: ExtractedEntities, incoming: ExtractedEntities): ExtractedEntities {
  return {
    symptom_side: incoming.symptom_side ?? existing.symptom_side,
    triggering_activity: incoming.triggering_activity ?? existing.triggering_activity,
    symptom_location: incoming.symptom_location ?? existing.symptom_location,
    symptom_description: incoming.symptom_description ?? existing.symptom_description,
  };
}

function getMissingEntities(entities: ExtractedEntities): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED_ENTITIES) {
    if (entities[key] === null) missing.push(key);
  }
  return missing;
}

// --- Process user message ---

export async function processMessage(
  state: AssessmentState,
  userMessage: string,
  tree: AssessmentTree,
  llm: LLMAdapter,
  conversationHistory: ConversationMessage[],
): Promise<ProcessResult> {
  log.info('Processing message', { sessionId: state.sessionId, status: state.status, userMessage });

  // 1. Extract entities via LLM
  const { entities: extracted } = await llm.extractEntities(userMessage, conversationHistory);
  log.debug('Extracted entities', { sessionId: state.sessionId, extracted });

  // 2. Merge with existing
  const merged = mergeEntities(state.entities, extracted);
  let updated: AssessmentState = { ...state, entities: merged, resolvedEntities: merged };

  // 3. Check for missing required entities
  const missing = getMissingEntities(merged);
  if (missing.length > 0) {
    log.info('Missing entities, requesting clarification', { sessionId: state.sessionId, missing });
    const { text } = await llm.generateClarification(missing, conversationHistory);
    updated = { ...updated, status: 'gathering' };
    saveSession(updated);
    return { reply: text, state: updated };
  }

  // 4. All entities resolved -> traverse decision tree
  const result = traverseTree(tree, merged);

  // 5. Tree returns modifications -> serve first unserved one
  if (result !== null) {
    log.info('Tree traversal succeeded', {
      sessionId: state.sessionId,
      path: result.path,
      modificationCount: result.modifications.length,
    });

    updated = {
      ...updated,
      status: 'recommending',
      currentNodePath: result.path,
      modifications: result.modifications,
      servedModifications: 1,
    };

    const firstMod = result.modifications[0];
    const { text } = await llm.generateWrapper(firstMod as unknown as Record<string, unknown>, conversationHistory);
    saveSession(updated);
    return { reply: text, state: updated, modification: firstMod };
  }

  // 6. Tree returns null (no coverage)
  log.info('No coverage for entities', { sessionId: state.sessionId, entities: merged });
  const availableActivities = getAvailableActivities(tree);
  const { text } = await llm.suggestAlternatives(merged, availableActivities);
  updated = { ...updated, status: 'no_coverage' };
  saveSession(updated);
  return { reply: text, state: updated };
}

// --- Process feedback ---

export interface FeedbackResult {
  reply: string;
  state: AssessmentState;
  modification?: Recommendation;
}

export async function processFeedback(
  state: AssessmentState,
  rating: number,
  llm: LLMAdapter,
  conversationHistory: ConversationMessage[],
): Promise<FeedbackResult> {
  log.info('Processing feedback', { sessionId: state.sessionId, rating, status: state.status });

  const updatedRatings = [...state.modificationRatings, rating];
  const isLow = rating <= 3;

  const newConsecutiveLow = isLow ? state.consecutiveLowRatings + 1 : 0;

  // 3 consecutive low ratings -> escalation
  if (newConsecutiveLow >= 3) {
    log.warn('Escalation triggered after 3 consecutive low ratings', { sessionId: state.sessionId });
    const updated: AssessmentState = {
      ...state,
      modificationRatings: updatedRatings,
      consecutiveLowRatings: newConsecutiveLow,
      status: 'escalated',
    };
    saveSession(updated);
    return {
      reply: 'It seems like these suggestions aren\'t quite hitting the mark. Let me connect you with a specialist who can provide more personalized guidance.',
      state: updated,
    };
  }

  // Score 4-5 -> wrap up
  if (rating >= 4) {
    log.info('Positive feedback, closing session', { sessionId: state.sessionId });
    const updated: AssessmentState = {
      ...state,
      modificationRatings: updatedRatings,
      consecutiveLowRatings: 0,
      status: 'closed',
    };
    saveSession(updated);
    return {
      reply: 'Great, glad that was helpful! Give it a try and let me know how it goes.',
      state: updated,
    };
  }

  // Score 1-3 -> serve next modification
  const nextIndex = state.servedModifications;
  if (nextIndex < state.modifications.length) {
    const nextMod = state.modifications[nextIndex];
    const { text } = await llm.generateWrapper(nextMod as unknown as Record<string, unknown>, conversationHistory);
    const updated: AssessmentState = {
      ...state,
      modificationRatings: updatedRatings,
      consecutiveLowRatings: newConsecutiveLow,
      servedModifications: nextIndex + 1,
    };
    saveSession(updated);
    return { reply: text, state: updated, modification: nextMod };
  }

  // No more modifications to serve
  log.info('No more modifications to serve', { sessionId: state.sessionId });
  const updated: AssessmentState = {
    ...state,
    modificationRatings: updatedRatings,
    consecutiveLowRatings: newConsecutiveLow,
    status: 'closed',
  };
  saveSession(updated);
  return {
    reply: 'I\'ve shared all the modifications I have for this. If the pain persists, consider checking in with a physical therapist.',
    state: updated,
  };
}

// --- Reset (for testing) ---

export const resetState = (): void => {
  treeCache.clear();
  sessionStore.clear();
};
