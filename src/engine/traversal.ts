import { createLogger } from '../logger.js';
import type {
  AssessmentTree,
  AssessmentNode,
  BranchRule,
  Condition,
  Recommendation,
  TreeNode,
  QuestionNode,
  MovementTestNode,
} from '../types/decision-tree.js';
import type { SessionState } from '../types/entities.js';
import type { ExtractedEntities } from '../types/entities.js';

const log = createLogger('traversal');

const MAX_DEPTH = 100;

// --- Condition evaluation (deterministic, no randomness) ---

export const evaluateCondition = (condition: Condition, answers: Record<string, unknown>): boolean => {
  switch (condition.type) {
    case 'always':
      return true;
    case 'equals': {
      const value = answers[condition.key];
      return value === condition.value;
    }
    case 'in': {
      const value = answers[condition.key];
      return condition.any_of.some((item) => item === value);
    }
    case 'range': {
      const value = answers[condition.key];
      if (typeof value !== 'number') return false;
      if (typeof condition.min === 'number' && value < condition.min) return false;
      if (typeof condition.max === 'number' && value > condition.max) return false;
      return true;
    }
    default:
      return false;
  }
};

export const pickNextNodeId = (
  rules: BranchRule[] | undefined,
  answers: Record<string, unknown>,
): string | null => {
  if (!rules || rules.length === 0) return null;
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, answers)) {
      return rule.next_node_id;
    }
  }
  return null;
};

// Used by state-machine for step-by-step progression
export const getNextNodeId = (
  tree: AssessmentTree,
  state: SessionState,
  currentNodeId: string,
): string | null => {
  const node = tree.nodes[currentNodeId];
  if (!node) return null;
  if (node.type === 'assessment') return null;
  return pickNextNodeId(node.next, state.answers);
};

// --- Entity-driven tree traversal ---

export interface TraversalResult {
  modifications: Recommendation[];
  path: string[];
}

/**
 * Flatten extracted entities into an answers dict that condition evaluation can use.
 * Entity fields map to the save_to / condition keys used in the tree.
 */
function entitiesToAnswers(entities: ExtractedEntities): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  if (entities.triggering_activity !== null) answers.triggering_activity = entities.triggering_activity;
  if (entities.symptom_location !== null) answers.symptom_location = entities.symptom_location;
  if (entities.symptom_side !== null) answers.symptom_side = entities.symptom_side;
  if (entities.symptom_description !== null) answers.symptom_description = entities.symptom_description;
  return answers;
}

/**
 * Traverse the decision tree using extracted entities.
 * Deterministic: identical entities always produce identical results.
 * Returns null if no path exists (never fabricates a recommendation).
 */
export function traverseTree(
  tree: AssessmentTree,
  entities: ExtractedEntities,
): TraversalResult | null {
  const answers = entitiesToAnswers(entities);
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = tree.entry_node_id;

  while (currentId) {
    // Circular reference guard
    if (visited.has(currentId)) {
      log.error('Circular reference detected in tree traversal', {
        treeId: tree.id,
        nodeId: currentId,
        path,
      });
      return null;
    }

    // Depth guard
    if (path.length >= MAX_DEPTH) {
      log.error('Max traversal depth reached', { treeId: tree.id, depth: MAX_DEPTH, path });
      return null;
    }

    const node = tree.nodes[currentId];
    if (!node) {
      log.warn('Node not found during traversal', { treeId: tree.id, nodeId: currentId, path });
      return null;
    }

    visited.add(currentId);
    path.push(currentId);

    log.debug('Visiting node', { treeId: tree.id, nodeId: currentId, nodeType: node.type });

    // Terminal node — return recommendations
    if (node.type === 'assessment') {
      const assessment = node as AssessmentNode;
      log.info('Traversal complete', {
        treeId: tree.id,
        assessmentId: currentId,
        path,
        recommendationCount: assessment.recommendations.length,
      });
      return {
        modifications: assessment.recommendations,
        path,
      };
    }

    // Branch node — find next
    const branchNode = node as QuestionNode | MovementTestNode;
    const nextId = pickNextNodeId(branchNode.next, answers);

    if (!nextId) {
      log.info('No matching branch rule, traversal ended with no path', {
        treeId: tree.id,
        nodeId: currentId,
        path,
        answers,
      });
      return null;
    }

    currentId = nextId;
  }

  return null;
}

/**
 * Returns the list of triggering_activity values the tree has branches for.
 * Scans the entry node (and any node with save_to === 'triggering_activity')
 * for equals/in conditions on the triggering_activity key, plus option values.
 */
export function getAvailableActivities(tree: AssessmentTree): string[] {
  const activities = new Set<string>();

  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'assessment') continue;

    const branchNode = node as QuestionNode | MovementTestNode;

    // Collect from option values on activity questions
    if (node.type === 'question') {
      const q = node as QuestionNode;
      if (q.save_to === 'triggering_activity' && q.options) {
        for (const opt of q.options) {
          activities.add(opt.value);
        }
      }
    }

    // Collect from branch conditions on triggering_activity
    if (branchNode.next) {
      for (const rule of branchNode.next) {
        const cond = rule.condition;
        if (cond.type === 'equals' && cond.key === 'triggering_activity' && typeof cond.value === 'string') {
          activities.add(cond.value);
        }
        if (cond.type === 'in' && cond.key === 'triggering_activity') {
          for (const v of cond.any_of) {
            if (typeof v === 'string') activities.add(v);
          }
        }
      }
    }
  }

  return [...activities].sort();
}
