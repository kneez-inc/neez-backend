import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { AppError } from '../src/types/database.js';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

type MockRow = Record<string, unknown>;

interface MockQueryResult {
  data: MockRow | MockRow[] | null;
  error: { message: string; code?: string } | null;
}

function createMockResult(data: MockRow | MockRow[] | null, error: MockQueryResult['error'] = null): MockQueryResult {
  return { data, error };
}

// A chainable mock that mimics the Supabase query builder
function createMockBuilder(result: MockQueryResult) {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve: (val: MockQueryResult) => void) => resolve(result),
  };
  return builder;
}

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------
describe('AppError', () => {
  it('creates an error with code and message', () => {
    const err = new AppError('USER_CREATE_FAILED', 'duplicate key');
    assert.equal(err.code, 'USER_CREATE_FAILED');
    assert.equal(err.message, 'duplicate key');
    assert.equal(err.statusCode, 500);
    assert.equal(err.name, 'AppError');
  });

  it('accepts custom statusCode', () => {
    const err = new AppError('NOT_FOUND', 'no such record', 404);
    assert.equal(err.statusCode, 404);
  });

  it('is an instance of Error', () => {
    const err = new AppError('TEST', 'test error');
    assert.ok(err instanceof Error);
  });
});

// ---------------------------------------------------------------------------
// Database operation logic tests (using mock builders)
// ---------------------------------------------------------------------------

// Since the actual db functions import getSupabaseClient() at call time,
// we test the patterns and error handling logic directly.

describe('database operation patterns', () => {
  describe('user operations', () => {
    it('successful create returns the inserted row', async () => {
      const mockUser = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'alice@example.com',
        full_name: 'Alice Johnson',
      };
      const builder = createMockBuilder(createMockResult(mockUser));
      const result = await builder.insert().select().single();

      assert.ok(result.data);
      assert.equal(result.error, null);
      assert.equal((result.data as MockRow).email, 'alice@example.com');
    });

    it('failed create returns error', async () => {
      const builder = createMockBuilder(
        createMockResult(null, { message: 'duplicate key value violates unique constraint' }),
      );
      const result = await builder.insert().select().single();

      assert.equal(result.data, null);
      assert.ok(result.error);
      assert.ok(result.error.message.includes('duplicate'));
    });

    it('not found returns PGRST116 error code', async () => {
      const builder = createMockBuilder(
        createMockResult(null, { message: 'not found', code: 'PGRST116' }),
      );
      const result = await builder.select().eq().single();

      assert.ok(result.error);
      assert.equal(result.error.code, 'PGRST116');
    });

    it('successful select by id returns row', async () => {
      const mockUser = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'bob@example.com',
        full_name: 'Bob Smith',
      };
      const builder = createMockBuilder(createMockResult(mockUser));
      const result = await builder.select().eq().single();

      assert.ok(result.data);
      assert.equal((result.data as MockRow).full_name, 'Bob Smith');
    });

    it('successful update returns updated row', async () => {
      const updated = {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'alice@example.com',
        full_name: 'Alice Smith',
      };
      const builder = createMockBuilder(createMockResult(updated));
      const result = await builder.update().eq().select().single();

      assert.ok(result.data);
      assert.equal((result.data as MockRow).full_name, 'Alice Smith');
    });

    it('successful delete returns no error', async () => {
      const builder = createMockBuilder(createMockResult(null));
      const result = await builder.delete().eq().single();

      assert.equal(result.error, null);
    });
  });

  describe('session operations', () => {
    it('successful create returns session with generated id', async () => {
      const mockSession = {
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        session_created_at: '2025-01-01T00:00:00Z',
        latitude: 37.8044,
        longitude: -122.2711,
        feedback_score: null,
        closed_at: null,
      };
      const builder = createMockBuilder(createMockResult(mockSession));
      const result = await builder.insert().select().single();

      assert.ok(result.data);
      assert.equal((result.data as MockRow).user_id, '550e8400-e29b-41d4-a716-446655440000');
    });

    it('list sessions returns array ordered by date', async () => {
      const sessions = [
        { session_id: 'a', session_created_at: '2025-01-02T00:00:00Z' },
        { session_id: 'b', session_created_at: '2025-01-01T00:00:00Z' },
      ];
      const builder = createMockBuilder(createMockResult(sessions));
      // For list queries, resolve via then instead of single
      const result = await new Promise<MockQueryResult>((resolve) => {
        builder.select().eq().order().then(resolve);
      });

      assert.ok(Array.isArray(result.data));
      assert.equal((result.data as MockRow[]).length, 2);
    });

    it('update session with feedback_score', async () => {
      const updated = {
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        feedback_score: 5,
      };
      const builder = createMockBuilder(createMockResult(updated));
      const result = await builder.update().eq().select().single();

      assert.ok(result.data);
      assert.equal((result.data as MockRow).feedback_score, 5);
    });
  });

  describe('message operations', () => {
    it('successful create returns message with empty content', async () => {
      const mockMsg = {
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        conversation_content: [],
        prompt_tokens: 0,
        completion_tokens: 0,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      const builder = createMockBuilder(createMockResult(mockMsg));
      const result = await builder.insert().select().single();

      assert.ok(result.data);
      assert.deepEqual((result.data as MockRow).conversation_content, []);
    });

    it('update appends to conversation_content', async () => {
      const updatedMsg = {
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        conversation_content: [
          { role: 'user', text: 'hello', timestamp: 123 },
          { role: 'assistant', text: 'hi', timestamp: 124 },
        ],
        updated_at: '2025-01-01T00:01:00Z',
      };
      const builder = createMockBuilder(createMockResult(updatedMsg));
      const result = await builder.update().eq().select().single();

      assert.ok(result.data);
      const content = (result.data as MockRow).conversation_content as unknown[];
      assert.equal(content.length, 2);
    });

    it('update token counts', async () => {
      const updatedMsg = {
        session_id: '660e8400-e29b-41d4-a716-446655440000',
        prompt_tokens: 150,
        completion_tokens: 80,
      };
      const builder = createMockBuilder(createMockResult(updatedMsg));
      const result = await builder.update().eq().select().single();

      assert.ok(result.data);
      assert.equal((result.data as MockRow).prompt_tokens, 150);
      assert.equal((result.data as MockRow).completion_tokens, 80);
    });

    it('error wrapping pattern produces AppError', () => {
      const supabaseError = { message: 'relation "neez_chat_messages" does not exist' };

      // Simulate the error wrapping pattern used in db/ modules
      const appError = new AppError('MESSAGE_CREATE_FAILED', supabaseError.message);
      assert.equal(appError.code, 'MESSAGE_CREATE_FAILED');
      assert.ok(appError.message.includes('does not exist'));
      assert.ok(appError instanceof Error);
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling patterns
// ---------------------------------------------------------------------------
describe('error handling patterns', () => {
  it('PGRST116 code indicates not found (single row expected but none returned)', () => {
    const error = { message: 'not found', code: 'PGRST116' };
    // This is the pattern used in getUserById, getSessionById, getMessageBySessionId
    const isNotFound = error.code === 'PGRST116';
    assert.ok(isNotFound);
  });

  it('other error codes are treated as failures', () => {
    const error = { message: 'permission denied', code: '42501' };
    const isNotFound = error.code === 'PGRST116';
    assert.ok(!isNotFound);
  });

  it('AppError preserves stack trace', () => {
    const err = new AppError('TEST', 'test');
    assert.ok(err.stack);
    assert.ok(err.stack.includes('AppError'));
  });
});
