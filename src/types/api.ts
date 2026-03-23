import { z } from 'zod';
import type { Recommendation } from './decision-tree.js';
import type { ExtractedEntities } from './entities.js';
import type { AssessmentStatus } from '../engine/state-machine.js';

// --- Request schemas ---

export const AssessRequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  message: z.string().min(1).optional(),
  feedback: z.number().int().min(1).max(5).optional(),
  version: z.string().default('v1-tree'),
});

export const TreeRequestSchema = z.object({
  version: z.string().default('v1'),
});

export type AssessRequest = z.infer<typeof AssessRequestSchema>;
export type TreeRequest = z.infer<typeof TreeRequestSchema>;

// --- Response types ---

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type AssessResponseData = {
  session_id: string;
  status: AssessmentStatus;
  reply: string;
  entities: ExtractedEntities;
  modification: Recommendation | null;
};

export type TreeResponseData = {
  valid: boolean;
  tree?: Record<string, unknown>;
};
