import { BranchRule, Condition } from '../types.js';

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
  answers: Record<string, unknown>
): string | null => {
  if (!rules || rules.length === 0) return null;
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, answers)) {
      return rule.next_node_id;
    }
  }
  return null;
};
