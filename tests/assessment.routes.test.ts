import assert from 'node:assert/strict';
import http from 'node:http';
import { beforeEach, describe, it } from 'node:test';

import { __testing, handleAssessmentRequest } from '../src/routes/assessment.js';

type TestServer = {
  server: http.Server;
  baseUrl: string;
};

const startServer = async (): Promise<TestServer> => {
  const server = http.createServer(async (req, res) => {
    await handleAssessmentRequest(req, res);
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

describe('assessment routes', () => {
  beforeEach(() => {
    __testing.resetState();
  });

  it('returns the knee region question', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/assessment/knee-regions`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.id, 'q_knee_region');
      assert.ok(Array.isArray(body.options));
      assert.ok(body.options.length > 0);
    } finally {
      await closeServer(server);
    }
  });

  it('returns the assessment tree for the default version', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/assessment/tree`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.entry_node_id, 'q_knee_region');
      assert.equal(body.id, 'kneez_assessment_v1');
    } finally {
      await closeServer(server);
    }
  });

  it('starts a session and returns the entry node', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/assessment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'v1' })
      });

      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.node.id, 'q_knee_region');
      assert.ok(typeof body.session_id === 'string');
      assert.ok(body.session_id.length > 0);
    } finally {
      await closeServer(server);
    }
  });

  it('returns a validation error when session_id is missing on /assessment/next', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/assessment/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.match(body.error, /session_id is required/);
    } finally {
      await closeServer(server);
    }
  });

  it('progresses through the assessment flow and marks completion on assessment nodes', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const startResponse = await fetch(`${baseUrl}/assessment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const startBody = await startResponse.json();

      const sessionId = startBody.session_id as string;

      const firstNextResponse = await fetch(`${baseUrl}/assessment/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answer: { node_id: 'q_knee_region', value: 'superomedial_patellofemoral_joint' }
        })
      });
      const firstNextBody = await firstNextResponse.json();

      assert.equal(firstNextResponse.status, 200);
      assert.equal(firstNextBody.next_node.id, 'test_squat');
      assert.equal(firstNextBody.completed, false);

      const assessmentResponse = await fetch(`${baseUrl}/assessment/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answer: { node_id: 'test_squat', value: 'worse' }
        })
      });
      const assessmentBody = await assessmentResponse.json();

      assert.equal(assessmentResponse.status, 200);
      assert.equal(assessmentBody.next_node.id, 'dx_patellofemoral');
      assert.equal(assessmentBody.completed, true);
      assert.equal(assessmentBody.answers.knee_region, 'superomedial_patellofemoral_joint');
    } finally {
      await closeServer(server);
    }
  });
});
