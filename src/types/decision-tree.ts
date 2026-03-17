import { z } from 'zod';

export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({ type: z.literal('equals'), key: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }),
  z.object({ type: z.literal('in'), key: z.string(), any_of: z.array(z.union([z.string(), z.number(), z.boolean()])) }),
  z.object({ type: z.literal('range'), key: z.string(), min: z.number().optional(), max: z.number().optional() }),
]);

export const BranchRuleSchema = z.object({
  condition: ConditionSchema,
  next_node_id: z.string(),
});

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['movement_mod', 'exercise', 'education', 'referral', 'other']),
  description: z.string(),
  video_id: z.string().optional(),
});

export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const BaseNodeFields = {
  id: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
};

export const QuestionNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('question'),
  prompt: z.string(),
  help_text: z.string().optional(),
  answer_type: z.enum(['choice', 'scale', 'boolean', 'free_text']),
  save_to: z.string(),
  options: z.array(QuestionOptionSchema).optional(),
  next: z.array(BranchRuleSchema),
});

export const MovementTestNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('movement_test'),
  title: z.string(),
  instructions: z.string(),
  video_id: z.string().optional(),
  metric_key: z.string(),
  metric_type: z.enum(['pain_change', 'pain_presence', 'rom_quality', 'other']),
  next: z.array(BranchRuleSchema),
});

export const AssessmentNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('assessment'),
  summary: z.string(),
  explanation: z.string(),
  region_id: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  recommendations: z.array(RecommendationSchema),
});

export const TreeNodeSchema = z.union([QuestionNodeSchema, MovementTestNodeSchema, AssessmentNodeSchema]);

export const AssessmentTreeSchema = z.object({
  id: z.string(),
  version: z.string(),
  title: z.string(),
  entry_node_id: z.string(),
  nodes: z.record(z.string(), TreeNodeSchema),
});

export type Condition = z.infer<typeof ConditionSchema>;
export type BranchRule = z.infer<typeof BranchRuleSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type QuestionNode = z.infer<typeof QuestionNodeSchema>;
export type MovementTestNode = z.infer<typeof MovementTestNodeSchema>;
export type AssessmentNode = z.infer<typeof AssessmentNodeSchema>;
export type TreeNode = z.infer<typeof TreeNodeSchema>;
export type AssessmentTree = z.infer<typeof AssessmentTreeSchema>;
export type AssessmentNodeMap = Record<string, TreeNode>;
