import winston from 'winston';
import { config } from './config.js';

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    config.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'neez-backend' },
  transports: [new winston.transports.Console()],
});

export const createLogger = (module: string) => logger.child({ module });
