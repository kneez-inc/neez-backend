import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExtractedEntitiesSchema } from '../src/types/entities.js';
import { AssessRequestSchema } from '../src/types/api.js';
import {
  NeezUserSchema,
  CreateNeezUserSchema,
  UpdateNeezUserSchema,
  NeezChatSessionSchema,
  CreateNeezChatSessionSchema,
  UpdateNeezChatSessionSchema,
  NeezChatMessageSchema,
  CreateNeezChatMessageSchema,
  UpdateNeezChatMessageSchema,
  ConversationMessageSchema,
} from '../src/types/database.js';

// ---------------------------------------------------------------------------
// ExtractedEntitiesSchema
// ---------------------------------------------------------------------------
describe('ExtractedEntitiesSchema', () => {
  it('accepts valid entities with all fields', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: 'left',
      triggering_activity: 'squatting',
      symptom_location: 'patella',
      symptom_description: 'sharp',
    });
    assert.ok(result.success);
  });

  it('accepts all-null entities', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: null,
      triggering_activity: null,
      symptom_location: null,
      symptom_description: null,
    });
    assert.ok(result.success);
  });

  it('rejects invalid symptom_side value', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: 'top',
      triggering_activity: null,
      symptom_location: null,
      symptom_description: null,
    });
    assert.ok(!result.success);
  });

  it('rejects invalid triggering_activity value', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: null,
      triggering_activity: 'flying',
      symptom_location: null,
      symptom_description: null,
    });
    assert.ok(!result.success);
  });

  it('rejects invalid symptom_location value', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: null,
      triggering_activity: null,
      symptom_location: 'elbow',
      symptom_description: null,
    });
    assert.ok(!result.success);
  });

  it('rejects invalid symptom_description value', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: null,
      triggering_activity: null,
      symptom_location: null,
      symptom_description: 'itchy',
    });
    assert.ok(!result.success);
  });

  it('rejects missing fields', () => {
    const result = ExtractedEntitiesSchema.safeParse({
      symptom_side: 'left',
    });
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// AssessRequestSchema
// ---------------------------------------------------------------------------
describe('AssessRequestSchema', () => {
  it('accepts empty body (new session, no message)', () => {
    const result = AssessRequestSchema.safeParse({});
    assert.ok(result.success);
    assert.equal(result.data.version, 'sample-tree');
  });

  it('accepts message only', () => {
    const result = AssessRequestSchema.safeParse({ message: 'my knee hurts' });
    assert.ok(result.success);
    assert.equal(result.data.message, 'my knee hurts');
  });

  it('accepts session_id + message', () => {
    const result = AssessRequestSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      message: 'test',
    });
    assert.ok(result.success);
  });

  it('accepts session_id + feedback', () => {
    const result = AssessRequestSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      feedback: 4,
    });
    assert.ok(result.success);
    assert.equal(result.data.feedback, 4);
  });

  it('rejects non-uuid session_id', () => {
    const result = AssessRequestSchema.safeParse({
      session_id: 'not-a-uuid',
      message: 'test',
    });
    assert.ok(!result.success);
  });

  it('rejects feedback out of range (0)', () => {
    const result = AssessRequestSchema.safeParse({ feedback: 0 });
    assert.ok(!result.success);
  });

  it('rejects feedback out of range (6)', () => {
    const result = AssessRequestSchema.safeParse({ feedback: 6 });
    assert.ok(!result.success);
  });

  it('rejects empty message string', () => {
    const result = AssessRequestSchema.safeParse({ message: '' });
    assert.ok(!result.success);
  });

  it('defaults version to sample-tree', () => {
    const result = AssessRequestSchema.safeParse({});
    assert.ok(result.success);
    assert.equal(result.data.version, 'sample-tree');
  });

  it('accepts custom version', () => {
    const result = AssessRequestSchema.safeParse({ version: 'v2' });
    assert.ok(result.success);
    assert.equal(result.data.version, 'v2');
  });
});

// ---------------------------------------------------------------------------
// ConversationMessageSchema
// ---------------------------------------------------------------------------
describe('ConversationMessageSchema', () => {
  it('accepts user text message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'user',
      text: 'hello',
      timestamp: 1690891500,
    });
    assert.ok(result.success);
  });

  it('accepts user feedback message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'user',
      feedback: 4,
      timestamp: 1690891600,
    });
    assert.ok(result.success);
  });

  it('accepts assistant message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'assistant',
      text: 'How can I help?',
      timestamp: 1690891515,
    });
    assert.ok(result.success);
  });

  it('accepts app recommendation message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'app',
      recommendation: 145,
      saved: true,
      timestamp: 1690891560,
    });
    assert.ok(result.success);
  });

  it('accepts app text message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'app',
      text: 'Would you like to try something else?',
      timestamp: 1690891570,
    });
    assert.ok(result.success);
  });

  it('rejects unknown role', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'system',
      text: 'nope',
      timestamp: 123,
    });
    assert.ok(!result.success);
  });

  it('rejects missing timestamp on user message', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'user',
      text: 'hello',
    });
    assert.ok(!result.success);
  });

  it('rejects feedback out of range', () => {
    const result = ConversationMessageSchema.safeParse({
      role: 'user',
      feedback: 10,
      timestamp: 123,
    });
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// NeezUserSchema
// ---------------------------------------------------------------------------
describe('NeezUserSchema', () => {
  const validUser = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alice@example.com',
    full_name: 'Alice Johnson',
    gender: 'Female',
    birth_date: '1990-05-15',
    device_type: 'iphone',
    sign_up_date: '2025-01-01T00:00:00Z',
    activation_date: '2025-01-01T01:00:00Z',
    first_chat_date: null,
    acquisition_source: 'Organic',
    metadata: { timezone: 'America/New_York' },
    created_at: '2025-01-01T00:00:00Z',
    last_seen_at: null,
  };

  it('accepts a valid user', () => {
    const result = NeezUserSchema.safeParse(validUser);
    assert.ok(result.success);
  });

  it('rejects invalid email', () => {
    const result = NeezUserSchema.safeParse({ ...validUser, email: 'not-email' });
    assert.ok(!result.success);
  });

  it('rejects invalid user_id', () => {
    const result = NeezUserSchema.safeParse({ ...validUser, user_id: 'abc' });
    assert.ok(!result.success);
  });

  it('allows nullable fields to be null', () => {
    const result = NeezUserSchema.safeParse({
      ...validUser,
      gender: null,
      birth_date: null,
      device_type: null,
      sign_up_date: null,
      activation_date: null,
      first_chat_date: null,
      acquisition_source: null,
      metadata: null,
      last_seen_at: null,
    });
    assert.ok(result.success);
  });
});

// ---------------------------------------------------------------------------
// CreateNeezUserSchema
// ---------------------------------------------------------------------------
describe('CreateNeezUserSchema', () => {
  it('accepts minimal required fields', () => {
    const result = CreateNeezUserSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'bob@example.com',
      full_name: 'Bob Smith',
    });
    assert.ok(result.success);
  });

  it('accepts all optional fields', () => {
    const result = CreateNeezUserSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'bob@example.com',
      full_name: 'Bob Smith',
      gender: 'Male',
      device_type: 'android',
      acquisition_source: 'Facebook Ads',
      metadata: { lang: 'en' },
    });
    assert.ok(result.success);
  });

  it('rejects missing email', () => {
    const result = CreateNeezUserSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      full_name: 'Bob',
    });
    assert.ok(!result.success);
  });

  it('rejects missing full_name', () => {
    const result = CreateNeezUserSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'bob@example.com',
    });
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// UpdateNeezUserSchema
// ---------------------------------------------------------------------------
describe('UpdateNeezUserSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdateNeezUserSchema.safeParse({ full_name: 'New Name' });
    assert.ok(result.success);
  });

  it('accepts empty object (no-op update)', () => {
    const result = UpdateNeezUserSchema.safeParse({});
    assert.ok(result.success);
  });

  it('accepts metadata update', () => {
    const result = UpdateNeezUserSchema.safeParse({
      metadata: { preferred_language: 'es' },
    });
    assert.ok(result.success);
  });
});

// ---------------------------------------------------------------------------
// NeezChatSessionSchema
// ---------------------------------------------------------------------------
describe('NeezChatSessionSchema', () => {
  it('accepts a valid session', () => {
    const result = NeezChatSessionSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '660e8400-e29b-41d4-a716-446655440000',
      session_created_at: '2025-01-01T00:00:00Z',
      latitude: 37.8044,
      longitude: -122.2711,
      feedback_score: 4,
      closed_at: null,
    });
    assert.ok(result.success);
  });

  it('rejects feedback_score out of range', () => {
    const result = NeezChatSessionSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '660e8400-e29b-41d4-a716-446655440000',
      session_created_at: '2025-01-01T00:00:00Z',
      latitude: null,
      longitude: null,
      feedback_score: 6,
      closed_at: null,
    });
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// CreateNeezChatSessionSchema
// ---------------------------------------------------------------------------
describe('CreateNeezChatSessionSchema', () => {
  it('accepts user_id only', () => {
    const result = CreateNeezChatSessionSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.ok(result.success);
  });

  it('accepts with optional geo fields', () => {
    const result = CreateNeezChatSessionSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      latitude: 40.7128,
      longitude: -74.006,
    });
    assert.ok(result.success);
  });

  it('rejects missing user_id', () => {
    const result = CreateNeezChatSessionSchema.safeParse({});
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// NeezChatMessageSchema
// ---------------------------------------------------------------------------
describe('NeezChatMessageSchema', () => {
  it('accepts a valid message record', () => {
    const result = NeezChatMessageSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      conversation_content: [
        { role: 'user', text: 'hello', timestamp: 1690891500 },
        { role: 'assistant', text: 'hi there', timestamp: 1690891515 },
      ],
      prompt_tokens: 50,
      completion_tokens: 30,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:01:00Z',
    });
    assert.ok(result.success);
  });

  it('rejects invalid conversation_content item', () => {
    const result = NeezChatMessageSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      conversation_content: [{ role: 'unknown', timestamp: 123 }],
      prompt_tokens: 0,
      completion_tokens: 0,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// CreateNeezChatMessageSchema
// ---------------------------------------------------------------------------
describe('CreateNeezChatMessageSchema', () => {
  it('accepts session_id with empty content', () => {
    const result = CreateNeezChatMessageSchema.safeParse({
      session_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.ok(result.success);
    assert.deepEqual(result.data.conversation_content, []);
  });

  it('rejects missing session_id', () => {
    const result = CreateNeezChatMessageSchema.safeParse({});
    assert.ok(!result.success);
  });
});

// ---------------------------------------------------------------------------
// UpdateNeezChatMessageSchema
// ---------------------------------------------------------------------------
describe('UpdateNeezChatMessageSchema', () => {
  it('accepts token count update', () => {
    const result = UpdateNeezChatMessageSchema.safeParse({
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    assert.ok(result.success);
  });

  it('accepts conversation_content update', () => {
    const result = UpdateNeezChatMessageSchema.safeParse({
      conversation_content: [
        { role: 'user', text: 'test', timestamp: 123 },
      ],
    });
    assert.ok(result.success);
  });

  it('accepts empty object', () => {
    const result = UpdateNeezChatMessageSchema.safeParse({});
    assert.ok(result.success);
  });
});
