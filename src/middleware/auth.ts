import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('auth');

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    log.warn('Supabase credentials not set — skipping auth in development');
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
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      log.warn('Token validation failed', { error: error?.message });
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    (req as AuthenticatedRequest).userId = user.id;
    next();
  } catch (err) {
    log.error('Auth middleware error', { error: (err as Error).message });
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
};
