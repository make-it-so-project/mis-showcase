/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  /** Port of the Approval Core server */
  APPROVAL_CORE_PORT: 4000,
  /** Default TTL for requests (5 minutes) */
  DEFAULT_TTL_SECONDS: 300,
  /** TTL for 2FA credentials (60 seconds) */
  CREDENTIAL_TTL_SECONDS: 60,
  /** Length of the 2FA code */
  CREDENTIAL_LENGTH: 6,
  /** API call timeout in milliseconds */
  API_TIMEOUT_MS: 30000,
} as const;

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  REQUESTS: '/api/requests',
  REQUEST_BY_ID: (id: string) => `/api/requests/${id}`,
  APPROVE: (id: string) => `/api/requests/${id}/approve`,
  DENY: (id: string) => `/api/requests/${id}/deny`,
  CANCEL: (id: string) => `/api/requests/${id}/cancel`,
  WEBSOCKET: '/ws',
} as const;

/**
 * Standardized error codes
 */
export const ERROR_CODES = {
  NOT_FOUND: 'REQUEST_NOT_FOUND',
  ALREADY_DECIDED: 'ALREADY_DECIDED',
  EXPIRED: 'REQUEST_EXPIRED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
