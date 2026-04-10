import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalRequest,
  ApprovalResponse,
  CreateApprovalRequest,
  CreateApprovalResponse,
  ApiError,
  ERROR_CODES,
  DEFAULT_CONFIG,
} from '@make-it-so/shared';
import { RequestStore } from './store.js';
import { CredentialGenerator } from './credentials.js';
import { WebSocketManager } from './websocket.js';

interface RouterDependencies {
  store: RequestStore;
  credentialGenerator: CredentialGenerator;
  wsManager: WebSocketManager;
}

/**
 * Creates the API router with all endpoints
 */
export function createRouter(deps: RouterDependencies): Router {
  const router = Router();
  const { store, credentialGenerator, wsManager } = deps;

  // Token store for approved requests
  const approvalTokens: Map<string, { requestId: string; expiresAt: Date }> = new Map();

  /**
   * POST /api/requests — Create a new approval request
   */
  router.post('/requests', async (req: Request, res: Response) => {
    try {
      const body = req.body as CreateApprovalRequest;

      // Validate required fields
      if (!body.action_type || !body.description || !body.user_ref) {
        return res.status(400).json({
          error: 'Missing required fields: action_type, description, user_ref',
          code: ERROR_CODES.INVALID_REQUEST,
        } satisfies ApiError);
      }

      const now = new Date();
      const ttlSeconds = body.ttl_seconds ?? DEFAULT_CONFIG.DEFAULT_TTL_SECONDS;
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

      const request: ApprovalRequest = {
        id: uuidv4(),
        action_type: body.action_type,
        description: body.description,
        user_ref: body.user_ref,
        metadata: body.metadata ?? undefined,
        requires_2fa: body.requires_2fa ?? false,
        status: 'PENDING',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      };

      await store.create(request);
      wsManager.notifyNewRequest(request);

      console.log(`[API] Created request ${request.id} for user ${request.user_ref}`);

      const response: CreateApprovalResponse = {
        request_id: request.id,
        status: request.status,
        expires_at: request.expires_at,
      };

      return res.status(201).json(response);
    } catch (err) {
      console.error('[API] Error creating request:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  /**
   * GET /api/requests — List all requests for a user_ref
   */
  router.get('/requests', async (req: Request, res: Response) => {
    try {
      const userRef = req.query.user_ref as string | undefined;
      const status = req.query.status as string | undefined;

      if (!userRef) {
        return res.status(400).json({
          error: 'Missing required query parameter: user_ref',
          code: ERROR_CODES.INVALID_REQUEST,
        } satisfies ApiError);
      }

      const requests = await store.getByUserRef(
        userRef,
        status as 'PENDING' | undefined
      );

      return res.json({ requests });
    } catch (err) {
      console.error('[API] Error fetching requests:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  /**
   * GET /api/requests/:id — Get the status of a single request
   */
  router.get('/requests/:id', async (req: Request, res: Response) => {
    try {
      const request = await store.getById(req.params.id!);

      if (!request) {
        return res.status(404).json({
          error: 'Request not found',
          code: ERROR_CODES.NOT_FOUND,
        } satisfies ApiError);
      }

      const response: ApprovalResponse = {
        status: request.status,
        request,
      };

      // Attach token if the request was approved
      if (request.status === 'APPROVED') {
        const tokenEntry = [...approvalTokens.entries()].find(
          ([, v]) => v.requestId === request.id
        );
        if (tokenEntry) {
          response.approval_token = tokenEntry[0];
        }
      }

      return res.json(response);
    } catch (err) {
      console.error('[API] Error fetching request:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  /**
   * POST /api/requests/:id/approve — Approve a request
   */
  router.post('/requests/:id/approve', async (req: Request, res: Response) => {
    try {
      const request = await store.getById(req.params.id!);

      if (!request) {
        return res.status(404).json({
          error: 'Request not found',
          code: ERROR_CODES.NOT_FOUND,
        } satisfies ApiError);
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({
          error: `Request already ${request.status.toLowerCase()}`,
          code: ERROR_CODES.ALREADY_DECIDED,
        } satisfies ApiError);
      }

      if (new Date(request.expires_at) < new Date()) {
        await store.updateStatus(request.id, 'EXPIRED');
        return res.status(400).json({
          error: 'Request has expired',
          code: ERROR_CODES.EXPIRED,
        } satisfies ApiError);
      }

      const updatedRequest = await store.updateStatus(request.id, 'APPROVED');
      if (!updatedRequest) {
        return res.status(500).json({
          error: 'Failed to update request',
          code: ERROR_CODES.INTERNAL_ERROR,
        } satisfies ApiError);
      }

      // Generate approval token (valid for 1 hour)
      const approvalToken = uuidv4();
      approvalTokens.set(approvalToken, {
        requestId: request.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const response: ApprovalResponse = {
        status: 'APPROVED',
        request: updatedRequest,
        approval_token: approvalToken,
      };

      // Generate 2FA credential if requested
      if (request.requires_2fa) {
        response.action_credential = credentialGenerator.generate();
      }

      wsManager.notifyStatusChanged(updatedRequest);

      console.log(`[API] Approved request ${request.id}`);

      return res.json(response);
    } catch (err) {
      console.error('[API] Error approving request:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  /**
   * POST /api/requests/:id/deny — Deny a request
   */
  router.post('/requests/:id/deny', async (req: Request, res: Response) => {
    try {
      const request = await store.getById(req.params.id!);

      if (!request) {
        return res.status(404).json({
          error: 'Request not found',
          code: ERROR_CODES.NOT_FOUND,
        } satisfies ApiError);
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({
          error: `Request already ${request.status.toLowerCase()}`,
          code: ERROR_CODES.ALREADY_DECIDED,
        } satisfies ApiError);
      }

      const updatedRequest = await store.updateStatus(request.id, 'DENIED');
      if (!updatedRequest) {
        return res.status(500).json({
          error: 'Failed to update request',
          code: ERROR_CODES.INTERNAL_ERROR,
        } satisfies ApiError);
      }

      wsManager.notifyStatusChanged(updatedRequest);

      console.log(`[API] Denied request ${request.id}`);

      const response: ApprovalResponse = {
        status: 'DENIED',
        request: updatedRequest,
      };

      return res.json(response);
    } catch (err) {
      console.error('[API] Error denying request:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  /**
   * POST /api/requests/:id/cancel — Cancel a pending request
   */
  router.post('/requests/:id/cancel', async (req: Request, res: Response) => {
    try {
      const request = await store.getById(req.params.id!);

      if (!request) {
        return res.status(404).json({
          error: 'Request not found',
          code: ERROR_CODES.NOT_FOUND,
        } satisfies ApiError);
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({
          error: `Request already ${request.status.toLowerCase()}`,
          code: ERROR_CODES.ALREADY_DECIDED,
        } satisfies ApiError);
      }

      const updatedRequest = await store.updateStatus(request.id, 'CANCELLED');
      if (!updatedRequest) {
        return res.status(500).json({
          error: 'Failed to update request',
          code: ERROR_CODES.INTERNAL_ERROR,
        } satisfies ApiError);
      }

      wsManager.notifyStatusChanged(updatedRequest);

      console.log(`[API] Cancelled request ${request.id}`);

      const response: ApprovalResponse = {
        status: 'CANCELLED',
        request: updatedRequest,
      };

      return res.json(response);
    } catch (err) {
      console.error('[API] Error cancelling request:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: ERROR_CODES.INTERNAL_ERROR,
      } satisfies ApiError);
    }
  });

  return router;
}
