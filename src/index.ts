/**
 * ARIS Platform SaaS - Server Entry Point
 */

import app from './app';
import { config, isDevelopment } from './config';
import { ErrorLogger } from './utils/errors';

const PORT = config.server.port;
const HOST = '0.0.0.0';

// ============ START SERVER ============
const server = app.listen(PORT, HOST, () => {
  ErrorLogger.logInfo(`🚀 ARIS Platform API running`, {
    port: PORT,
    environment: config.server.env,
    url: `http://localhost:${PORT}`,
  });
});

// ============ GRACEFUL SHUTDOWN ============
const shutdown = (signal: string) => {
  ErrorLogger.logInfo(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    ErrorLogger.logInfo('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    ErrorLogger.log(new Error('Forced shutdown after timeout'), {
      context: 'gracefulShutdown',
    });
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============ ERROR HANDLING ============
server.on('error', (error: Error) => {
  ErrorLogger.log(error, { context: 'serverError' });
  process.exit(1);
});

export default server;
