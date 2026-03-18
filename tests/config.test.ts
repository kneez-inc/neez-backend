import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';

// Re-declare the EnvSchema here to test validation logic without triggering
// process.exit from the actual config module.
const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
});

describe('EnvSchema (config validation)', () => {
  it('applies defaults for empty env', () => {
    const result = EnvSchema.safeParse({});
    assert.ok(result.success);
    assert.equal(result.data.PORT, 3000);
    assert.equal(result.data.NODE_ENV, 'development');
    assert.equal(result.data.LOG_LEVEL, 'info');
    assert.equal(result.data.LLM_PROVIDER, 'gemini');
  });

  it('coerces PORT from string to number', () => {
    const result = EnvSchema.safeParse({ PORT: '8080' });
    assert.ok(result.success);
    assert.equal(result.data.PORT, 8080);
  });

  it('rejects invalid NODE_ENV', () => {
    const result = EnvSchema.safeParse({ NODE_ENV: 'staging' });
    assert.ok(!result.success);
  });

  it('rejects invalid LOG_LEVEL', () => {
    const result = EnvSchema.safeParse({ LOG_LEVEL: 'trace' });
    assert.ok(!result.success);
  });

  it('rejects invalid LLM_PROVIDER', () => {
    const result = EnvSchema.safeParse({ LLM_PROVIDER: 'mistral' });
    assert.ok(!result.success);
  });

  it('accepts valid SUPABASE_URL', () => {
    const result = EnvSchema.safeParse({
      SUPABASE_URL: 'https://abc.supabase.co',
    });
    assert.ok(result.success);
    assert.equal(result.data.SUPABASE_URL, 'https://abc.supabase.co');
  });

  it('rejects non-url SUPABASE_URL', () => {
    const result = EnvSchema.safeParse({
      SUPABASE_URL: 'not-a-url',
    });
    assert.ok(!result.success);
  });

  it('rejects empty SUPABASE_ANON_KEY', () => {
    const result = EnvSchema.safeParse({
      SUPABASE_ANON_KEY: '',
    });
    assert.ok(!result.success);
  });

  it('accepts all valid values together', () => {
    const result = EnvSchema.safeParse({
      PORT: '4000',
      NODE_ENV: 'production',
      LOG_LEVEL: 'error',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      GEMINI_API_KEY: 'AIzaSyTest123',
      LLM_PROVIDER: 'gemini',
    });
    assert.ok(result.success);
    assert.equal(result.data.PORT, 4000);
    assert.equal(result.data.NODE_ENV, 'production');
    assert.equal(result.data.LOG_LEVEL, 'error');
    assert.equal(result.data.LLM_PROVIDER, 'gemini');
  });

  it('allows optional fields to be omitted', () => {
    const result = EnvSchema.safeParse({
      PORT: '3000',
      NODE_ENV: 'test',
    });
    assert.ok(result.success);
    assert.equal(result.data.SUPABASE_URL, undefined);
    assert.equal(result.data.SUPABASE_ANON_KEY, undefined);
    assert.equal(result.data.GEMINI_API_KEY, undefined);
  });
});
