import { Router, Request, Response } from 'express';
import { AssessRequestSchema } from '../types/api.js';
import { AppError } from '../types/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  loadTree,
  createSession,
  getOrCreateSession,
  processMessage,
  processFeedback,
} from '../engine/state-machine.js';
import { createLLMAdapter, MockLLMAdapter } from '../engine/llm-adapter.js';
import type { LLMAdapter } from '../engine/llm-adapter.js';
import type { ConversationMessage } from '../types/messages.js';
import type { QuickReplyOption } from '../types/api.js';
import { ACTIVITY_GROUPS } from '../types/controlled-vocabulary.js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('assess');

// Use real LLM in production/dev when API key is available; mock for tests or missing key
let llm: LLMAdapter;
if (config.NODE_ENV === 'test' || !config.GEMINI_API_KEY) {
  llm = new MockLLMAdapter();
  log.warn('Using MockLLMAdapter (keyword matching only)', { reason: config.NODE_ENV === 'test' ? 'test environment' : 'no GEMINI_API_KEY' });
} else {
  llm = createLLMAdapter(config.LLM_PROVIDER, config.GEMINI_API_KEY);
  log.info('Using real LLM adapter', { provider: config.LLM_PROVIDER });
}

// Per-session conversation history (in-memory cache, same lifecycle as session state)
const sessionHistory = new Map<string, ConversationMessage[]>();

function getHistory(sessionId: string): ConversationMessage[] {
  if (!sessionHistory.has(sessionId)) {
    sessionHistory.set(sessionId, []);
  }
  return sessionHistory.get(sessionId)!;
}

function addToHistory(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const history = getHistory(sessionId);
  history.push({ role, content, timestamp: new Date().toISOString() });
}

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
        addToHistory(state.sessionId, 'user', message);
        const result = await processMessage(state, message, tree, llm, getHistory(state.sessionId));
        addToHistory(state.sessionId, 'assistant', result.reply);
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
            options: result.options ?? null,
          },
        });
        return;
      }

      // Build welcome options from activity groups
      const WELCOME_LABELS: Record<string, string> = {
        squat: 'Squats',
        lunge: 'Lunges',
        run: 'Running',
        walk: 'Walking / Hiking',
        stair: 'Stairs',
        kneel: 'Kneeling',
        deadlift: 'Deadlifts',
        yoga: 'Yoga',
      };
      const welcomeOptions: QuickReplyOption[] = Object.entries(ACTIVITY_GROUPS)
        .filter(([key]) => key in WELCOME_LABELS)
        .map(([key]) => ({ value: key, label: WELCOME_LABELS[key] }));
      welcomeOptions.push({ value: 'other', label: 'Something else' });

      res.json({
        success: true,
        data: {
          session_id: state.sessionId,
          status: state.status,
          reply: "Let's move at your pace. What activity is giving your knees trouble?",
          entities: state.entities,
          modification: null,
          options: welcomeOptions,
        },
      });
      return;
    }

    // --- Existing session (seed in-memory state on first use) ---
    const state = getOrCreateSession(session_id, version);

    // --- Feedback path ---
    if (feedback !== undefined) {
      log.info('Processing feedback', { userId, sessionId: session_id, feedback, status: state.status });
      const result = await processFeedback(state, feedback, llm, getHistory(session_id));
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
          options: null,
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
    addToHistory(session_id, 'user', message);
    const result = await processMessage(state, message, tree, llm, getHistory(session_id));
    addToHistory(session_id, 'assistant', result.reply);
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
        options: result.options ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      log.error('Database error', { userId, code: err.code, error: err.message });
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    log.error('Unhandled assessment error', { userId, error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to process request' },
    });
  }
});
