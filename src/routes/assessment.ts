import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { createSession, loadAssessmentTree, loadKneeRegionQuestion, progressSession } from '../assessment/index.js';
import { AnswerPayload, AssessmentTree, SessionState } from '../assessment/types.js';

const treeCache = new Map<string, AssessmentTree>();
const sessionStore = new Map<string, SessionState>();

const getTree = (version: string) => {
  if (treeCache.has(version)) return treeCache.get(version)!;
  const tree = loadAssessmentTree(version);
  treeCache.set(version, tree);
  return tree;
};

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload, null, 2));
};

const parseBody = async (req: IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
};

const notFound = (res: ServerResponse) => sendJson(res, 404, { error: 'Not Found' });

export const handleAssessmentRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/assessment/knee-regions') {
    const question = loadKneeRegionQuestion();
    sendJson(res, 200, question);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/assessment/tree') {
    const version = url.searchParams.get('version') ?? 'v1';
    const tree = getTree(version);
    sendJson(res, 200, tree);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/assessment/start') {
    const body = await parseBody(req);
    const version = typeof body?.version === 'string' ? body.version : 'v1';
    const tree = getTree(version);
    const session = createSession(tree);
    sessionStore.set(session.sessionId, session);
    sendJson(res, 200, { session_id: session.sessionId, node: tree.nodes[tree.entry_node_id] });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/assessment/next') {
    try {
      const body = await parseBody(req);
      const sessionId = body?.session_id as string | undefined;
      if (!sessionId) {
        sendJson(res, 400, { error: 'session_id is required' });
        return;
      }

      const session = sessionStore.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Session not found' });
        return;
      }

      const requestedVersion = typeof body?.version === 'string' ? body.version : session.treeVersion;
      if (requestedVersion !== session.treeVersion) {
        sendJson(res, 400, { error: 'Version mismatch with existing session' });
        return;
      }

      const tree = getTree(requestedVersion);
      const answer = body?.answer as AnswerPayload | undefined;
      if (!answer || !answer.node_id) {
        sendJson(res, 400, { error: 'answer with node_id is required' });
        return;
      }

      if (!tree.nodes[answer.node_id]) {
        sendJson(res, 400, { error: `Node ${answer.node_id} does not exist in tree ${tree.id}` });
        return;
      }

      const { session: updatedSession, nextNode } = progressSession(tree, session, answer);
      sessionStore.set(sessionId, updatedSession);
      sendJson(res, 200, {
        session_id: sessionId,
        answers: updatedSession.answers,
        next_node: nextNode,
        completed: nextNode?.type === 'assessment'
      });
    } catch (error: any) {
      sendJson(res, 400, { error: error?.message ?? 'Unable to process request' });
    }
    return;
  }

  notFound(res);
};
