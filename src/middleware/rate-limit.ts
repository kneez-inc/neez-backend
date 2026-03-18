import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { createLogger } from '../logger.js';

const log = createLogger('rate-limit');

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

// Clean stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60_000).unref();

export const resetRateLimits = (): void => {
  buckets.clear();
};

export const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const key = (req as AuthenticatedRequest).userId ?? req.ip ?? 'unknown';
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > MAX_REQUESTS) {
    log.warn('Rate limit exceeded', { key, count: entry.count });
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' },
    });
    return;
  }

  next();
};
