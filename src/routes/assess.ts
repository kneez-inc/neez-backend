import { Router, Request, Response } from 'express';
import { AssessRequestSchema } from '../types/api.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  loadTree,
  createSession,
  getOrCreateSession,
  processMessage,
  processFeedback,
} from '../engine/state-machine.js';
import { MockLLMAdapter } from '../engine/llm-adapter.js';
import { createLogger } from '../logger.js';

const log = createLogger('assess');

// TODO: wire up real LLM adapter via createLLMAdapter(config.LLM_PROVIDER, config.GEMINI_API_KEY)
const llm = new MockLLMAdapter();

export const assessRouter = Router();

assessRouter.post('/', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).userId;

  try {
    const parsed = AssessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      log.warn('Validation failed', { userId, errors: parsed.error.flatten().fieldErrors });
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' },
      });
      return;
    }

    const { session_id, message, feedback, version } = parsed.data;
    const tree = loadTree(version);

    // --- New session ---
    if (!session_id) {
      const state = createSession(version);
      log.info('Session created', { userId, sessionId: state.sessionId, version });

      if (message) {
        const result = await processMessage(state, message, tree, llm, []);
        log.info('Initial message processed', {
          userId,
          sessionId: result.state.sessionId,
          status: result.state.status,
          entities: result.state.entities,
        });
        res.json({
          success: true,
          data: {
            session_id: result.state.sessionId,
            status: result.state.status,
            reply: result.reply,
            entities: result.state.entities,
            modification: result.modification ?? null,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          session_id: state.sessionId,
          status: state.status,
          reply: 'Tell me about your knee pain — what activity triggers it and where does it hurt?',
          entities: state.entities,
          modification: null,
        },
      });
      return;
    }

    // --- Existing session (seed in-memory state on first use) ---
    const state = getOrCreateSession(session_id, version);

    // --- Feedback path ---
    if (feedback !== undefined) {
      log.info('Processing feedback', { userId, sessionId: session_id, feedback, status: state.status });
      const result = await processFeedback(state, feedback, llm, []);
      log.info('Feedback processed', {
        userId,
        sessionId: session_id,
        rating: feedback,
        newStatus: result.state.status,
        consecutiveLow: result.state.consecutiveLowRatings,
        servedCount: result.state.servedModifications,
      });
      res.json({
        success: true,
        data: {
          session_id,
          status: result.state.status,
          reply: result.reply,
          entities: result.state.entities,
          modification: result.modification ?? null,
        },
      });
      return;
    }

    // --- Message path ---
    if (!message) {
      log.warn('Missing message for existing session', { userId, sessionId: session_id });
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_INPUT', message: 'Either message or feedback is required' },
      });
      return;
    }

    log.info('Processing message', { userId, sessionId: session_id, status: state.status });
    const result = await processMessage(state, message, tree, llm, []);
    log.info('Message processed', {
      userId,
      sessionId: session_id,
      newStatus: result.state.status,
      entities: result.state.entities,
      hasModification: !!result.modification,
    });

    res.json({
      success: true,
      data: {
        session_id,
        status: result.state.status,
        reply: result.reply,
        entities: result.state.entities,
        modification: result.modification ?? null,
      },
    });
  } catch (err) {
    log.error('Unhandled assessment error', { userId, error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to process request' },
    });
  }
});
