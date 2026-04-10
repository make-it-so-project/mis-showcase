import type {
  ApprovalRequest,
  ApprovalResponse,
  ApiError,
} from '@make-it-so/shared';

const DEFAULT_BASE_URL = 'http://localhost:4000';

export class ApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async listPending(userRef: string): Promise<ApprovalRequest[]> {
    const response = await fetch(
      `${this.baseUrl}/api/requests?user_ref=${encodeURIComponent(userRef)}&status=PENDING`
    );

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(error.error);
    }

    const data = await response.json() as { requests: ApprovalRequest[] };
    return data.requests;
  }

  async getRequest(id: string): Promise<ApprovalResponse> {
    const response = await fetch(`${this.baseUrl}/api/requests/${id}`);

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(error.error);
    }

    return response.json() as Promise<ApprovalResponse>;
  }

  async approve(id: string): Promise<ApprovalResponse> {
    const response = await fetch(`${this.baseUrl}/api/requests/${id}/approve`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(error.error);
    }

    return response.json() as Promise<ApprovalResponse>;
  }

  async deny(id: string): Promise<ApprovalResponse> {
    const response = await fetch(`${this.baseUrl}/api/requests/${id}/deny`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new Error(error.error);
    }

    return response.json() as Promise<ApprovalResponse>;
  }
}
