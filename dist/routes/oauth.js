"use strict";
/**
 * OAuth Routes - Handle Google, HubSpot, Twilio OAuth callbacks
 * Endpoints: POST /api/oauth/callback
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oauth_service_1 = require("../services/oauth.service");
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
// ============ OAUTH CALLBACK ENDPOINT ============
/**
 * POST /api/oauth/callback
 * Handle OAuth callback from Google, HubSpot, Twilio
 *
 * Request body:
 * {
 *   "code": "auth_code",
 *   "customer_id": "customer_uuid",
 *   "provider": "google|hubspot|twilio",
 *   "state": "state_token" (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "provider": "google",
 *     "customer_id": "customer_uuid",
 *     "expires_at": "2026-10-14T10:00:00Z"
 *   }
 * }
 */
router.post('/callback', (0, errors_1.asyncHandler)(async (req, res) => {
    const { code, customer_id, provider, state } = req.body;
    // ============ INPUT VALIDATION ============
    if (!code) {
        throw errors_1.ErrorFactory.validationError('Authorization code is required');
    }
    if (!customer_id) {
        throw errors_1.ErrorFactory.validationError('Customer ID is required');
    }
    if (!provider) {
        throw errors_1.ErrorFactory.validationError('Provider is required (google, hubspot, twilio)');
    }
    if (!errors_1.Validators.uuid(customer_id)) {
        throw errors_1.ErrorFactory.validationError('Invalid customer ID format');
    }
    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
        throw errors_1.ErrorFactory.validationError('Invalid provider. Must be google, hubspot, or twilio');
    }
    // ============ PROCESS OAUTH ============
    let oauthToken;
    switch (provider) {
        case 'google':
            oauthToken = await oauth_service_1.OAuthService.handleGoogleOAuth(code, customer_id);
            break;
        case 'hubspot':
            oauthToken = await oauth_service_1.OAuthService.handleHubSpotOAuth(code, customer_id);
            break;
        case 'twilio':
            oauthToken = await oauth_service_1.OAuthService.handleTwilioOAuth(code, customer_id);
            break;
        default:
            throw errors_1.ErrorFactory.validationError(`Unsupported provider: ${provider}`);
    }
    // ============ RETURN RESPONSE ============
    res.json({
        success: true,
        data: {
            provider,
            customer_id,
            expires_at: oauthToken.expires_at,
            message: `Successfully authenticated with ${provider}`,
        },
    });
}));
// ============ GET OAUTH STATUS ============
/**
 * GET /api/oauth/status/:customer_id/:provider
 * Check if OAuth token exists and is valid
 */
router.get('/status/:customer_id/:provider', (0, errors_1.asyncHandler)(async (req, res) => {
    const { customer_id, provider } = req.params;
    if (!errors_1.Validators.uuid(customer_id)) {
        throw errors_1.ErrorFactory.validationError('Invalid customer ID');
    }
    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
        throw errors_1.ErrorFactory.validationError('Invalid provider');
    }
    const isValid = await oauth_service_1.OAuthService.verifyToken(customer_id, provider);
    res.json({
        success: true,
        data: {
            customer_id,
            provider,
            connected: isValid,
        },
    });
}));
// ============ REFRESH OAUTH TOKEN ============
/**
 * POST /api/oauth/refresh
 * Refresh an expired OAuth token
 *
 * TODO: Implement token refresh logic in OAuthService
 */
/*
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { customer_id, provider } = req.body;

    if (!customer_id) {
      throw ErrorFactory.validationError('Customer ID is required');
    }

    if (!provider) {
      throw ErrorFactory.validationError('Provider is required');
    }

    if (!Validators.uuid(customer_id)) {
      throw ErrorFactory.validationError('Invalid customer ID');
    }

    const newToken = await OAuthService.refreshToken(customer_id, provider);

    res.json({
      success: true,
      data: {
        customer_id,
        provider,
        refreshed: true,
        token_length: newToken.length,
      },
    });
  })
);
*/
// ============ DISCONNECT OAUTH ============
/**
 * DELETE /api/oauth/disconnect
 * Remove OAuth token (disconnect service)
 */
router.delete('/disconnect', (0, errors_1.asyncHandler)(async (req, res) => {
    const { customer_id, provider } = req.body;
    if (!customer_id) {
        throw errors_1.ErrorFactory.validationError('Customer ID is required');
    }
    if (!provider) {
        throw errors_1.ErrorFactory.validationError('Provider is required');
    }
    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
        throw errors_1.ErrorFactory.validationError('Invalid provider');
    }
    await oauth_service_1.OAuthService.deleteToken(customer_id, provider);
    res.json({
        success: true,
        data: {
            customer_id,
            provider,
            disconnected: true,
        },
    });
}));
// ============ REMOVED: /info ENDPOINT ============
// SECURITY FIX: Endpoint removed (was exposing client IDs)
// Frontend gets OAuth URLs from config/frontend directly
exports.default = router;
//# sourceMappingURL=oauth.js.map