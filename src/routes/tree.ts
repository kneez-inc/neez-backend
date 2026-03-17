import { Router, Request, Response } from 'express';
import { AssessmentTreeSchema } from '../types/decision-tree.js';
import type { AssessmentTree, QuestionNode, MovementTestNode } from '../types/decision-tree.js';
import { loadTree } from '../engine/state-machine.js';
import { createLogger } from '../logger.js';

const log = createLogger('tree');

export const treeRouter = Router();

interface TreeStats {
  nodeCount: number;
  questionNodes: number;
  movementTestNodes: number;
  assessmentNodes: number;
  totalRecommendations: number;
  maxDepth: number;
}

interface ValidationResult {
  valid: boolean;
  stats?: TreeStats;
  errors?: string[];
}

function validateTree(tree: AssessmentTree): ValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set(Object.keys(tree.nodes));

  // --- Zod schema validation ---
  const zodResult = AssessmentTreeSchema.safeParse(tree);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push(`Schema: ${issue.path.join('.')} — ${issue.message}`);
    }
    return { valid: false, errors };
  }

  // --- Entry node exists ---
  if (!nodeIds.has(tree.entry_node_id)) {
    errors.push(`Entry node "${tree.entry_node_id}" not found in nodes`);
  }

  // --- Collect all referenced node IDs from branch rules ---
  const referencedIds = new Set<string>();
  referencedIds.add(tree.entry_node_id);

  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'assessment') continue;
    const branchNode = node as QuestionNode | MovementTestNode;
    for (const rule of branchNode.next) {
      referencedIds.add(rule.next_node_id);
    }
  }

  // --- Orphan nodes (exist but never referenced) ---
  for (const id of nodeIds) {
    if (!referencedIds.has(id)) {
      errors.push(`Orphan node: "${id}" is never referenced by any branch rule or entry_node_id`);
    }
  }

  // --- Missing node references (referenced but don't exist) ---
  for (const id of referencedIds) {
    if (!nodeIds.has(id)) {
      errors.push(`Missing node: "${id}" is referenced but does not exist`);
    }
  }

  // --- Assessment nodes must have at least one recommendation ---
  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'assessment' && node.recommendations.length === 0) {
      errors.push(`Assessment node "${node.id}" has no recommendations`);
    }
  }

  // --- Circular reference detection via DFS ---
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string, depth: number): number {
    if (inStack.has(nodeId)) {
      errors.push(`Circular reference: cycle detected involving node "${nodeId}"`);
      return depth;
    }
    if (visited.has(nodeId)) return depth;
    if (!nodeIds.has(nodeId)) return depth;

    visited.add(nodeId);
    inStack.add(nodeId);

    const node = tree.nodes[nodeId];
    let maxChildDepth = depth;

    if (node.type !== 'assessment') {
      const branchNode = node as QuestionNode | MovementTestNode;
      for (const rule of branchNode.next) {
        const childDepth = dfs(rule.next_node_id, depth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }

    inStack.delete(nodeId);
    return maxChildDepth;
  }

  const maxDepth = dfs(tree.entry_node_id, 0);

  // --- Unreachable nodes (not visited by DFS from entry) ---
  for (const id of nodeIds) {
    if (!visited.has(id)) {
      errors.push(`Unreachable node: "${id}" cannot be reached from entry node "${tree.entry_node_id}"`);
    }
  }

  // --- Stats ---
  let questionNodes = 0;
  let movementTestNodes = 0;
  let assessmentNodes = 0;
  let totalRecommendations = 0;

  for (const node of Object.values(tree.nodes)) {
    if (node.type === 'question') questionNodes++;
    else if (node.type === 'movement_test') movementTestNodes++;
    else if (node.type === 'assessment') {
      assessmentNodes++;
      totalRecommendations += node.recommendations.length;
    }
  }

  const stats: TreeStats = {
    nodeCount: nodeIds.size,
    questionNodes,
    movementTestNodes,
    assessmentNodes,
    totalRecommendations,
    maxDepth,
  };

  if (errors.length > 0) {
    return { valid: false, errors, stats };
  }

  return { valid: true, stats };
}

treeRouter.get('/validate', (req: Request, res: Response) => {
  try {
    const version = typeof req.query.version === 'string' ? req.query.version : 'sample-tree';
    const tree = loadTree(version);
    const result = validateTree(tree);

    log.info('Tree validation complete', { version, valid: result.valid, stats: result.stats });

    if (!result.valid) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TREE', message: 'Tree validation failed' },
        data: { valid: false, errors: result.errors, stats: result.stats },
      });
      return;
    }

    res.json({
      success: true,
      data: { valid: true, stats: result.stats },
    });
  } catch (err) {
    log.error('Tree validation error', { error: (err as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (err as Error).message },
    });
  }
});
