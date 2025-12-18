import { pickNextNodeId } from './evaluateNode.js';
import { AssessmentTree, SessionState } from '../types.js';

export const getNextNodeId = (
  tree: AssessmentTree,
  state: SessionState,
  currentNodeId: string
): string | null => {
  const node = tree.nodes[currentNodeId];
  if (!node) return null;

  if (node.type === 'assessment') {
    return null;
  }

  return pickNextNodeId(node.next, state.answers);
};
