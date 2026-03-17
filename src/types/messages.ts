import { z } from 'zod';

export const ConversationMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    content: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    role: z.literal('assistant'),
    content: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    role: z.literal('app_recommendation'),
    content: z.string(),
    node_id: z.string(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    role: z.literal('user_feedback'),
    content: z.string(),
    rating: z.number().min(1).max(5).optional(),
    timestamp: z.string().datetime(),
  }),
  z.object({
    role: z.literal('app_prompt'),
    content: z.string(),
    node_id: z.string(),
    timestamp: z.string().datetime(),
  }),
]);

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// Answer payload for tree progression
export const AnswerPayloadSchema = z.object({
  node_id: z.string(),
  value: z.unknown(),
});

export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>;
