/**
 * OAuth Routes - Handle Google, HubSpot, Twilio OAuth callbacks
 * Endpoints: POST /api/oauth/callback
 */

import { Router, Request, Response } from 'express';
import { OAuthService } from '../services/oauth.service';
import { asyncHandler, ErrorFactory, Validators } from '../utils/errors';
import { OAuthCallbackRequest } from '../types';

const router = Router();

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
router.post(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, customer_id, provider, state } = req.body as OAuthCallbackRequest & {
      state?: string;
    };

    // ============ INPUT VALIDATION ============
    if (!code) {
      throw ErrorFactory.validationError('Authorization code is required');
    }

    if (!customer_id) {
      throw ErrorFactory.validationError('Customer ID is required');
    }

    if (!provider) {
      throw ErrorFactory.validationError('Provider is required (google, hubspot, twilio)');
    }

    if (!Validators.uuid(customer_id)) {
      throw ErrorFactory.validationError('Invalid customer ID format');
    }

    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
      throw ErrorFactory.validationError(
        'Invalid provider. Must be google, hubspot, or twilio'
      );
    }

    // ============ PROCESS OAUTH ============
    let oauthToken;

    switch (provider) {
      case 'google':
        oauthToken = await OAuthService.handleGoogleOAuth(code, customer_id);
        break;

      case 'hubspot':
        oauthToken = await OAuthService.handleHubSpotOAuth(code, customer_id);
        break;

      case 'twilio':
        oauthToken = await OAuthService.handleTwilioOAuth(code, customer_id);
        break;

      default:
        throw ErrorFactory.validationError(`Unsupported provider: ${provider}`);
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
  })
);

// ============ GET OAUTH STATUS ============
/**
 * GET /api/oauth/status/:customer_id/:provider
 * Check if OAuth token exists and is valid
 */
router.get(
  '/status/:customer_id/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const { customer_id, provider } = req.params;

    if (!Validators.uuid(customer_id)) {
      throw ErrorFactory.validationError('Invalid customer ID');
    }

    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
      throw ErrorFactory.validationError('Invalid provider');
    }

    const isValid = await OAuthService.verifyToken(customer_id, provider);

    res.json({
      success: true,
      data: {
        customer_id,
        provider,
        connected: isValid,
      },
    });
  })
);

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
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const { customer_id, provider } = req.body;

    if (!customer_id) {
      throw ErrorFactory.validationError('Customer ID is required');
    }

    if (!provider) {
      throw ErrorFactory.validationError('Provider is required');
    }

    if (!['google', 'hubspot', 'twilio'].includes(provider)) {
      throw ErrorFactory.validationError('Invalid provider');
    }

    await OAuthService.deleteToken(customer_id, provider);

    res.json({
      success: true,
      data: {
        customer_id,
        provider,
        disconnected: true,
      },
    });
  })
);

// ============ REMOVED: /info ENDPOINT ============
// SECURITY FIX: Endpoint removed (was exposing client IDs)
// Frontend gets OAuth URLs from config/frontend directly

export default router;
