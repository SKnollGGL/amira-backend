"use strict";
/**
 * ARIS Platform SaaS - Server Entry Point
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const errors_1 = require("./utils/errors");
const PORT = config_1.config.server.port;
const HOST = '0.0.0.0';
// ============ START SERVER ============
const server = app_1.default.listen(PORT, HOST, () => {
    errors_1.ErrorLogger.logInfo(`🚀 ARIS Platform API running`, {
        port: PORT,
        environment: config_1.config.server.env,
        url: `http://localhost:${PORT}`,
    });
});
// ============ GRACEFUL SHUTDOWN ============
const shutdown = (signal) => {
    errors_1.ErrorLogger.logInfo(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
        errors_1.ErrorLogger.logInfo('Server closed');
        process.exit(0);
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
        errors_1.ErrorLogger.log(new Error('Forced shutdown after timeout'), {
            context: 'gracefulShutdown',
        });
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// ============ ERROR HANDLING ============
server.on('error', (error) => {
    errors_1.ErrorLogger.log(error, { context: 'serverError' });
    process.exit(1);
});
exports.default = server;
//# sourceMappingURL=index.js.map