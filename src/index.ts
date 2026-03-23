import http from 'node:http';
import { app } from './server.js';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { loadTree } from './engine/state-machine.js';
import { AssessmentTreeSchema } from './types/decision-tree.js';

const log = createLogger('startup');

// --- Validate and load decision tree at startup ---
try {
  const tree = loadTree('v1-tree');
  const result = AssessmentTreeSchema.safeParse(tree);
  if (!result.success) {
    log.error('Decision tree validation failed at startup', {
      errors: result.error.flatten().fieldErrors,
    });
    process.exit(1);
  }
  log.info('Decision tree loaded and validated', {
    treeId: tree.id,
    nodeCount: Object.keys(tree.nodes).length,
  });
} catch (err) {
  log.error('Failed to load decision tree at startup', { error: (err as Error).message });
  process.exit(1);
}

// --- Start server ---
const server = http.createServer(app);

server.listen(config.PORT, () => {
  log.info(`neez assessment server listening on port ${config.PORT}`, {
    env: config.NODE_ENV,
    port: config.PORT,
  });
});

// --- Graceful shutdown ---
function shutdown(signal: string) {
  log.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections don't close
  setTimeout(() => {
    log.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
