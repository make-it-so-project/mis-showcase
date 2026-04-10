import { z } from 'zod';
import { ApprovalCoreClient } from './client.js';

/**
 * Schema for the request_approval tool
 */
export const requestApprovalSchema = z.object({
  action_type: z.string().describe('Action type (e.g. "bank_transfer", "contract_sign")'),
  description: z.string().describe('Human-readable description of the action'),
  user_ref: z.string().describe('Reference to the user'),
  metadata: z.record(z.unknown()).optional().describe('Optional metadata for the action'),
  requires_2fa: z.boolean().optional().describe('Whether a 2FA code is required'),
  ttl_seconds: z.number().optional().describe('Request TTL in seconds'),
});

/**
 * Schema for the check_approval_status tool
 */
export const checkStatusSchema = z.object({
  request_id: z.string().describe('ID of the approval request'),
});

/**
 * Schema for the cancel_approval tool
 */
export const cancelApprovalSchema = z.object({
  request_id: z.string().describe('ID of the approval request'),
});

/**
 * Schema for the list_pending_approvals tool
 */
export const listPendingSchema = z.object({
  user_ref: z.string().describe('Reference to the user'),
});

/**
 * MCP tool definitions
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'request_approval',
    description: `Requests human approval for a security-critical action.

This tool creates an approval request that must be confirmed by the user
via the web app or CLI. The request expires after a configurable TTL (default: 5 minutes).

Use this tool for:
- Bank transfers
- Contract signing
- Bookings and reservations
- Changes to production systems
- Access to confidential data

Returns:
- request_id: unique ID of the request
- status: "PENDING" (waiting for human decision)
- expires_at: when the request expires`,
    inputSchema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          description: 'Action type (e.g. "bank_transfer", "contract_sign")',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the action',
        },
        user_ref: {
          type: 'string',
          description: 'Reference to the user',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for the action',
        },
        requires_2fa: {
          type: 'boolean',
          description: 'Whether a 2FA code is required',
        },
        ttl_seconds: {
          type: 'number',
          description: 'Request TTL in seconds (default: 300)',
        },
      },
      required: ['action_type', 'description', 'user_ref'],
    },
  },
  {
    name: 'check_approval_status',
    description: `Checks the status of an approval request.

Possible statuses:
- PENDING: waiting for human decision
- APPROVED: approved (includes approval_token and optionally a 2FA code)
- DENIED: denied
- EXPIRED: expired
- CANCELLED: cancelled

On APPROVED, an approval_token and optionally an action_credential (2FA code) are returned.`,
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'ID of the approval request',
        },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'cancel_approval',
    description: `Cancels a pending approval request.

Can only be used for requests with status PENDING.`,
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'ID of the approval request',
        },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'list_pending_approvals',
    description: `Lists all pending approval requests for a user.`,
    inputSchema: {
      type: 'object',
      properties: {
        user_ref: {
          type: 'string',
          description: 'Reference to the user',
        },
      },
      required: ['user_ref'],
    },
  },
];

/**
 * Tool handler implementations
 */
export function createToolHandlers(client: ApprovalCoreClient) {
  return {
    async request_approval(args: z.infer<typeof requestApprovalSchema>) {
      const result = await client.createRequest({
        action_type: args.action_type,
        description: args.description,
        user_ref: args.user_ref,
        metadata: args.metadata ?? undefined,
        requires_2fa: args.requires_2fa ?? undefined,
        ttl_seconds: args.ttl_seconds ?? undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              request_id: result.request_id,
              status: result.status,
              expires_at: result.expires_at,
              message: 'Approval request created. The user can approve it via the web app or CLI with "Make it so!"',
            }, null, 2),
          },
        ],
      };
    },

    async check_approval_status(args: z.infer<typeof checkStatusSchema>) {
      const result = await client.getRequest(args.request_id);

      const response: Record<string, unknown> = {
        request_id: result.request.id,
        status: result.status,
        action_type: result.request.action_type,
        description: result.request.description,
      };

      if (result.status === 'APPROVED') {
        response.approval_token = result.approval_token;
        if (result.action_credential) {
          response.action_credential = result.action_credential;
        }
        response.message = 'Make it so! The user has approved the action.';
      } else if (result.status === 'DENIED') {
        response.message = 'Request was denied.';
      } else if (result.status === 'EXPIRED') {
        response.message = 'Request has expired.';
      } else if (result.status === 'CANCELLED') {
        response.message = 'Request was cancelled.';
      } else {
        response.expires_at = result.request.expires_at;
        response.message = 'Waiting for user approval.';
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },

    async cancel_approval(args: z.infer<typeof cancelApprovalSchema>) {
      const result = await client.cancelRequest(args.request_id);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              request_id: result.request.id,
              status: result.status,
              message: 'Approval request was cancelled.',
            }, null, 2),
          },
        ],
      };
    },

    async list_pending_approvals(args: z.infer<typeof listPendingSchema>) {
      const requests = await client.listPending(args.user_ref);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              user_ref: args.user_ref,
              pending_count: requests.length,
              requests: requests.map((r) => ({
                request_id: r.id,
                action_type: r.action_type,
                description: r.description,
                expires_at: r.expires_at,
                created_at: r.created_at,
              })),
            }, null, 2),
          },
        ],
      };
    },
  };
}
