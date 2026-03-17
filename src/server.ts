import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requireAuth } from './middleware/auth.js';
import { assessRouter } from './routes/assess.js';
import { treeRouter } from './routes/tree.js';
import { createLogger } from './logger.js';

const log = createLogger('server');

export const app = express();

// --- Security & parsing ---
app.use(helmet());
app.use(cors());
app.use(express.json());

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
app.use('/assess', requireAuth, assessRouter);
app.use('/tree', treeRouter); // No auth — validation utility

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// --- Global error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});
