export type Condition =
  | { type: 'always' }
  | { type: 'equals'; key: string; value: string | number | boolean }
  | { type: 'in'; key: string; any_of: Array<string | number | boolean> }
  | { type: 'range'; key: string; min?: number; max?: number };

export type BranchRule = {
  condition: Condition;
  next_node_id: string;
};

export type Recommendation = {
  id: string;
  title: string;
  type: 'movement_mod' | 'exercise' | 'education' | 'referral' | 'other';
  description: string;
  video_id?: string;
};

export type BaseNode = {
  id: string;
  type: 'question' | 'movement_test' | 'assessment';
  label?: string;
  description?: string;
  source?: string;
};

export type QuestionOption = {
  value: string;
  label: string;
};

export type QuestionNode = BaseNode & {
  type: 'question';
  prompt: string;
  help_text?: string;
  answer_type: 'choice' | 'scale' | 'boolean' | 'free_text';
  save_to: string;
  options?: QuestionOption[];
  next: BranchRule[];
};

export type MovementTestNode = BaseNode & {
  type: 'movement_test';
  title: string;
  instructions: string;
  video_id?: string;
  metric_key: string;
  metric_type: 'pain_change' | 'pain_presence' | 'rom_quality' | 'other';
  next: BranchRule[];
};

export type AssessmentNode = BaseNode & {
  type: 'assessment';
  summary: string;
  explanation: string;
  region_id: string;
  confidence?: 'low' | 'medium' | 'high';
  recommendations: Recommendation[];
};

export type AssessmentNodeMap = Record<string, QuestionNode | MovementTestNode | AssessmentNode>;

export type AssessmentTree = {
  id: string;
  version: string;
  title: string;
  entry_node_id: string;
  nodes: AssessmentNodeMap;
};

export type AnswerPayload = {
  node_id: string;
  value: unknown;
};

export type SessionState = {
  sessionId: string;
  treeId: string;
  treeVersion: string;
  currentNodeId: string;
  answers: Record<string, unknown>;
  history: Array<{ node_id: string; value: unknown; timestamp: string }>;
  startedAt: string;
  updatedAt: string;
};
