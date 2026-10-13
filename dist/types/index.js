"use strict";
/**
 * Type definitions for ARIS Platform SaaS Backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
// ============ ERROR TYPES ============
class AppError extends Error {
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
//# sourceMappingURL=index.js.map