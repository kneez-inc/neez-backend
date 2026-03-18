import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requireAuth } from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';
import { assessRouter } from './routes/assess.js';
import { treeRouter } from './routes/tree.js';
import { createLogger } from './logger.js';

const log = createLogger('server');

export const app = express();

// --- Security & parsing ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// --- Request logging ---
app.use((req, _res, next) => {
  log.info('Incoming request', { method: req.method, path: req.path });
  next();
});

// --- Health check (unauthenticated) ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Routes ---
app.use('/assess', requireAuth, rateLimit, assessRouter);
app.use('/tree', treeRouter); // No auth — validation utility

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// --- Global error handler ---
app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Body parser errors (payload too large, malformed JSON)
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 10KB limit' },
    });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Malformed JSON in request body' },
    });
    return;
  }

  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});
