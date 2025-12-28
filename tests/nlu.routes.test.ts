import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { __testing, handleNluRequest } from '../src/routes/nlu.js';

type TestServer = {
  server: http.Server;
  baseUrl: string;
};

const httpFetch = globalThis.fetch;

const startServer = async (): Promise<TestServer> => {
  const server = http.createServer(async (req, res) => {
    await handleNluRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, baseUrl: `http://localhost:${port}` };
};

const closeServer = (server: http.Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

describe('nlu routes', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.OPENAI_API_KEY;

  const buildMockFetch =
    (intentForMessage: (message: string) => string) =>
    async (_input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const body = JSON.parse((options?.body as string) ?? '{}');
      const userContent = body.input?.find((part: any) => part?.role === 'user')?.content ?? '';
      const marker = 'User message:\n';
      const start = typeof userContent === 'string' ? userContent.indexOf(marker) : -1;
      const message =
        typeof userContent === 'string' && start >= 0 ? userContent.slice(start + marker.length) : '';

      const intent = intentForMessage(message);
      return new Response(JSON.stringify({ output_text: JSON.stringify({ intent }) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalEnv;
  });

  it('classifies intents via GET query', async () => {
    const clientFetch = httpFetch ?? globalThis.fetch;
    globalThis.fetch = buildMockFetch(() => 'general_education');
    const { server, baseUrl } = await startServer();

    try {
      const response = await clientFetch(`${baseUrl}/nlu/intent?text=hi there`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.intent, 'general_education');
      assert.equal(body.text, 'hi there');
    } finally {
      await closeServer(server);
    }
  });

  it('classifies intents via POST body', async () => {
    const clientFetch = httpFetch ?? globalThis.fetch;
    globalThis.fetch = buildMockFetch((message) =>
      message.includes('downstairs') ? 'acute_relief' : 'rehab_request'
    );
    const { server, baseUrl } = await startServer();

    try {
      const response = await clientFetch(`${baseUrl}/nlu/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'the back of my right knee hurts when I go downstairs' })
      });

      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.intent, 'acute_relief');
    } finally {
      await closeServer(server);
    }
  });

  it('returns a validation error when text is missing', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/nlu/intent`, { method: 'POST' });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.match(body.error, /text is required/);
    } finally {
      await closeServer(server);
    }
  });

  it('exposes classifyIntent helper for testing', async () => {
    globalThis.fetch = buildMockFetch(() => 'rehab_request');
    const result = await __testing.classifyIntent('how do I strengthen my knee');
    assert.equal(result.intent, 'rehab_request');
    assert.ok(result.raw.length > 0);
  });
});
