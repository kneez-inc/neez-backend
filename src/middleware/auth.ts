import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('auth');

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.SUPABASE_ANON_KEY) {
    log.warn('SUPABASE_ANON_KEY not set — skipping auth in development');
    (req as AuthenticatedRequest).userId = 'dev-user';
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.SUPABASE_ANON_KEY, {
      algorithms: ['HS256'],
    });

    const sub = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).sub : undefined;
    if (typeof sub !== 'string') {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token missing user ID' },
      });
      return;
    }

    (req as AuthenticatedRequest).userId = sub;
    next();
  } catch (err) {
    log.warn('JWT verification failed', { error: (err as Error).message });
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
};
