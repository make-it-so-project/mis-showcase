import {
  ApprovalResponse,
  CreateApprovalRequest,
  CreateApprovalResponse,
  ApprovalRequest,
  ApiError,
  API_ENDPOINTS,
  DEFAULT_CONFIG,
} from '@make-it-so/shared';

/**
 * HTTP client for communicating with the Approval Core
 */
export class ApprovalCoreClient {
  constructor(
    private readonly baseUrl: string = `http://localhost:${DEFAULT_CONFIG.APPROVAL_CORE_PORT}`,
    private readonly timeoutMs: number = DEFAULT_CONFIG.API_TIMEOUT_MS
  ) {}

  /**
   * Creates a new approval request
   */
  async createRequest(request: CreateApprovalRequest): Promise<CreateApprovalResponse> {
    const response = await this.fetch(API_ENDPOINTS.REQUESTS, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(`Failed to create request: ${error.error}`);
    }

    return response.json() as Promise<CreateApprovalResponse>;
  }

  /**
   * Retrieves the status of a request
   */
  async getRequest(requestId: string): Promise<ApprovalResponse> {
    const response = await this.fetch(API_ENDPOINTS.REQUEST_BY_ID(requestId));

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(`Failed to get request: ${error.error}`);
    }

    return response.json() as Promise<ApprovalResponse>;
  }

  /**
   * Lists all pending requests for a user_ref
   */
  async listPending(userRef: string): Promise<ApprovalRequest[]> {
    const url = `${API_ENDPOINTS.REQUESTS}?user_ref=${encodeURIComponent(userRef)}&status=PENDING`;
    const response = await this.fetch(url);

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(`Failed to list requests: ${error.error}`);
    }

    const data = await response.json() as { requests: ApprovalRequest[] };
    return data.requests;
  }

  /**
   * Cancels a pending request
   */
  async cancelRequest(requestId: string): Promise<ApprovalResponse> {
    const response = await this.fetch(API_ENDPOINTS.CANCEL(requestId), {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(`Failed to cancel request: ${error.error}`);
    }

    return response.json() as Promise<ApprovalResponse>;
  }

  /**
   * Executes an HTTP request with timeout
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
