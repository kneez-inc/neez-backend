import { z } from 'zod';

// ---------------------------------------------------------------------------
// neez_users
// ---------------------------------------------------------------------------
export const NeezUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  gender: z.string().nullable(),
  birth_date: z.string().nullable(), // ISO date string
  device_type: z.string().nullable(),
  sign_up_date: z.string().nullable(),
  activation_date: z.string().nullable(),
  first_chat_date: z.string().nullable(),
  acquisition_source: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  last_seen_at: z.string().nullable(),
});

export type NeezUser = z.infer<typeof NeezUserSchema>;

export const CreateNeezUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  gender: z.string().optional(),
  birth_date: z.string().optional(),
  device_type: z.string().optional(),
  sign_up_date: z.string().optional(),
  activation_date: z.string().optional(),
  acquisition_source: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateNeezUser = z.infer<typeof CreateNeezUserSchema>;

export const UpdateNeezUserSchema = z.object({
  full_name: z.string().optional(),
  gender: z.string().optional(),
  birth_date: z.string().optional(),
  device_type: z.string().optional(),
  activation_date: z.string().optional(),
  first_chat_date: z.string().optional(),
  acquisition_source: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  last_seen_at: z.string().optional(),
});

export type UpdateNeezUser = z.infer<typeof UpdateNeezUserSchema>;

// ---------------------------------------------------------------------------
// neez_chat_sessions
// ---------------------------------------------------------------------------
export const NeezChatSessionSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  session_created_at: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  feedback_score: z.number().int().min(1).max(5).nullable(),
  closed_at: z.string().nullable(),
});

export type NeezChatSession = z.infer<typeof NeezChatSessionSchema>;

export const CreateNeezChatSessionSchema = z.object({
  user_id: z.string().uuid(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type CreateNeezChatSession = z.infer<typeof CreateNeezChatSessionSchema>;

export const UpdateNeezChatSessionSchema = z.object({
  feedback_score: z.number().int().min(1).max(5).optional(),
  closed_at: z.string().optional(),
});

export type UpdateNeezChatSession = z.infer<typeof UpdateNeezChatSessionSchema>;

// ---------------------------------------------------------------------------
// neez_chat_messages
// ---------------------------------------------------------------------------
export const ConversationMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    text: z.string().optional(),
    feedback: z.number().int().min(1).max(5).optional(),
    timestamp: z.number(),
  }),
  z.object({
    role: z.literal('assistant'),
    text: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    role: z.literal('app'),
    text: z.string().optional(),
    recommendation: z.number().optional(),
    saved: z.boolean().optional(),
    timestamp: z.number(),
  }),
]);

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const NeezChatMessageSchema = z.object({
  session_id: z.string().uuid(),
  conversation_content: z.array(ConversationMessageSchema),
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NeezChatMessage = z.infer<typeof NeezChatMessageSchema>;

export const CreateNeezChatMessageSchema = z.object({
  session_id: z.string().uuid(),
  conversation_content: z.array(ConversationMessageSchema).default([]),
});

export type CreateNeezChatMessage = z.infer<typeof CreateNeezChatMessageSchema>;

export const UpdateNeezChatMessageSchema = z.object({
  conversation_content: z.array(ConversationMessageSchema).optional(),
  prompt_tokens: z.number().int().optional(),
  completion_tokens: z.number().int().optional(),
});

export type UpdateNeezChatMessage = z.infer<typeof UpdateNeezChatMessageSchema>;

// ---------------------------------------------------------------------------
// AppError — typed wrapper for database operation failures
// ---------------------------------------------------------------------------
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
