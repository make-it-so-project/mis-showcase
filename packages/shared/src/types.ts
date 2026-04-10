/**
 * Possible statuses of an approval request
 */
export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'EXPIRED'
  | 'CANCELLED';

/**
 * Type of an action credential (e.g. 2FA code)
 */
export type ActionCredentialType = 'one_time_code' | 'totp' | 'tan';

/**
 * Action credential returned after approval
 * (e.g. a TAN for a bank transfer)
 */
export interface ActionCredential {
  /** Credential type */
  type: ActionCredentialType;
  /** The actual value (e.g. 6-digit code) */
  value: string;
  /** Expiry timestamp (ISO 8601) */
  expires_at: string;
}

/**
 * Metadata attached to an approval request.
 * Can hold arbitrary additional information.
 */
export interface ApprovalMetadata {
  /** Optional action category */
  category?: string;
  /** Optional amount (for financial transactions) */
  amount?: number;
  /** Optional currency */
  currency?: string;
  /** Optional recipient */
  recipient?: string;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Input shape for creating a new approval request
 */
export interface CreateApprovalRequest {
  /** Action type (e.g. 'bank_transfer', 'contract_sign') */
  action_type: string;
  /** Human-readable description of the action */
  description: string;
  /** Reference to the user for whom approval is requested */
  user_ref: string;
  /** Optional metadata */
  metadata?: ApprovalMetadata;
  /** Whether a 2FA code is required */
  requires_2fa?: boolean;
  /** Optional TTL in seconds (default: 300) */
  ttl_seconds?: number;
}

/**
 * Full approval request including server-generated fields
 */
export interface ApprovalRequest extends CreateApprovalRequest {
  /** Unique request ID */
  id: string;
  /** Current status */
  status: ApprovalStatus;
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Expiry timestamp (ISO 8601) */
  expires_at: string;
  /** Last status change timestamp (ISO 8601) */
  updated_at: string;
}

/**
 * Response to an approval request status query
 */
export interface ApprovalResponse {
  /** Current status */
  status: ApprovalStatus;
  /** The full request object */
  request: ApprovalRequest;
  /** Opaque approval token (only present when APPROVED) */
  approval_token?: string;
  /** Action credential (only present when APPROVED with 2FA) */
  action_credential?: ActionCredential;
}

/**
 * Response returned when a new approval request is created
 */
export interface CreateApprovalResponse {
  /** ID of the created request */
  request_id: string;
  /** Status (always PENDING initially) */
  status: ApprovalStatus;
  /** Expiry timestamp (ISO 8601) */
  expires_at: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | 'new_request'
  | 'status_changed'
  | 'request_expired'
  | 'subscribe'
  | 'unsubscribe'
  | 'error';

/**
 * WebSocket message envelope
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  /** Affected request ID */
  request_id?: string;
  /** Affected user ref (for subscriptions) */
  user_ref?: string;
  /** Full request object (for new_request, status_changed) */
  request?: ApprovalRequest;
  /** Error message (for error type) */
  error?: string;
}

/**
 * API error response shape
 */
export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Configuration for the Approval Core server
 */
export interface ApprovalCoreConfig {
  /** HTTP server port */
  port: number;
  /** Default TTL for requests in seconds */
  default_ttl_seconds: number;
  /** TTL for 2FA credentials in seconds */
  credential_ttl_seconds: number;
  /** Length of the 2FA code */
  credential_length: number;
}

/**
 * Configuration for the MCP server
 */
export interface McpServerConfig {
  /** URL of the Approval Core */
  approval_core_url: string;
  /** Timeout for API calls in milliseconds */
  api_timeout_ms: number;
}
