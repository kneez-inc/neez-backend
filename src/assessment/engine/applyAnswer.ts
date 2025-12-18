import { AnswerPayload, AssessmentTree, MovementTestNode, QuestionNode, SessionState } from '../types.js';

const getSaveKey = (node: QuestionNode | MovementTestNode): string | null => {
  if (node.type === 'question') return node.save_to;
  if (node.type === 'movement_test') return node.metric_key;
  return null;
};

export const applyAnswer = (
  tree: AssessmentTree,
  state: SessionState,
  answer: AnswerPayload
): SessionState => {
  const node = tree.nodes[answer.node_id];
  if (!node || node.type === 'assessment') {
    return state;
  }

  const saveKey = getSaveKey(node as QuestionNode | MovementTestNode);
  const now = new Date().toISOString();
  const updatedAnswers = { ...state.answers };
  if (saveKey) {
    updatedAnswers[saveKey] = answer.value;
  }

  return {
    ...state,
    answers: updatedAnswers,
    history: [...state.history, { node_id: answer.node_id, value: answer.value, timestamp: now }],
    updatedAt: now
  };
};
