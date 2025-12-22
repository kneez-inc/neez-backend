import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  AnswerPayload,
  AssessmentNode,
  AssessmentNodeMap,
  AssessmentTree,
  MovementTestNode,
  QuestionNode,
  SessionState
} from './types.js';
import { applyAnswer } from './engine/applyAnswer.js';
import { getNextNodeId } from './engine/getNextNode.js';

const ASSESSMENT_ROOT = path.resolve('src/assessment');

const parseJsonFile = (filePath: string): any => {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const cleaned = raw.startsWith('```') ? raw.replace(/^```\w*\s*/u, '').replace(/```\s*$/u, '') : raw;
  return JSON.parse(cleaned);
};

const hydrateNodeWithSource = (node: QuestionNode | MovementTestNode | AssessmentNode, baseDir: string) => {
  if (!node.source) return node;
  const externalPath = path.resolve(baseDir, node.source);
  const externalNode = parseJsonFile(externalPath);
  const { source: _discard, ...rest } = node;
  const merged = {
    ...externalNode,
    ...rest,
    next: rest.type === 'assessment' ? undefined : (rest as QuestionNode | MovementTestNode).next ?? externalNode.next
  } as QuestionNode | MovementTestNode | AssessmentNode;
  return merged;
};

export const loadAssessmentTree = (version: string): AssessmentTree => {
  const treePath = path.resolve(ASSESSMENT_ROOT, 'trees', version, 'assessment_tree.json');
  const baseDir = path.dirname(treePath);
  const tree = parseJsonFile(treePath) as AssessmentTree;

  const nodes: AssessmentNodeMap = {};
  Object.values(tree.nodes).forEach((node) => {
    const hydrated = hydrateNodeWithSource(node, baseDir);
    nodes[hydrated.id] = hydrated;
  });

  const hydratedTree: AssessmentTree = { ...tree, nodes };
  if (!hydratedTree.nodes[hydratedTree.entry_node_id]) {
    throw new Error(`Entry node ${hydratedTree.entry_node_id} not found in tree ${hydratedTree.id}`);
  }

  return hydratedTree;
};

export const loadKneeRegionQuestion = (): QuestionNode => {
  const filePath = path.resolve(ASSESSMENT_ROOT, 'trees', 'v1', 'knee_regions.json');
  const node = parseJsonFile(filePath) as QuestionNode;
  return node;
};

export const createSession = (tree: AssessmentTree, treeVersionOverride?: string): SessionState => {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    sessionId,
    treeId: tree.id,
    treeVersion: treeVersionOverride ?? tree.version,
    currentNodeId: tree.entry_node_id,
    answers: {},
    history: [],
    startedAt: now,
    updatedAt: now
  };
};

export const progressSession = (
  tree: AssessmentTree,
  session: SessionState,
  answer: AnswerPayload
): { session: SessionState; nextNode: AssessmentNode | MovementTestNode | QuestionNode | null } => {
  const updatedSession = applyAnswer(tree, session, answer);
  const nextNodeId = getNextNodeId(tree, updatedSession, answer.node_id);

  if (!nextNodeId) {
    return { session: updatedSession, nextNode: null };
  }

  return {
    session: { ...updatedSession, currentNodeId: nextNodeId },
    nextNode: tree.nodes[nextNodeId]
  };
};

export const getNode = (tree: AssessmentTree, nodeId: string) => tree.nodes[nodeId];
