import { ApprovalRequest, ApprovalStatus } from '@make-it-so/shared';

/**
 * Interface for the request store.
 * Allows swapping in a database-backed implementation later.
 */
export interface RequestStore {
  create(request: ApprovalRequest): Promise<ApprovalRequest>;
  getById(id: string): Promise<ApprovalRequest | null>;
  getByUserRef(userRef: string, status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest | null>;
  delete(id: string): Promise<boolean>;
  cleanup(): Promise<number>;
}

/**
 * In-memory implementation of the request store.
 * Intended for showcase and development use only.
 */
export class InMemoryStore implements RequestStore {
  private requests: Map<string, ApprovalRequest> = new Map();

  async create(request: ApprovalRequest): Promise<ApprovalRequest> {
    this.requests.set(request.id, { ...request });
    return request;
  }

  async getById(id: string): Promise<ApprovalRequest | null> {
    const request = this.requests.get(id);
    if (!request) return null;

    // Mark as expired if TTL has passed
    if (request.status === 'PENDING' && new Date(request.expires_at) < new Date()) {
      request.status = 'EXPIRED';
      request.updated_at = new Date().toISOString();
      this.requests.set(id, request);
    }

    return { ...request };
  }

  async getByUserRef(userRef: string, status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const results: ApprovalRequest[] = [];
    const now = new Date();

    for (const request of this.requests.values()) {
      if (request.user_ref !== userRef) continue;

      // Mark as expired if TTL has passed
      if (request.status === 'PENDING' && new Date(request.expires_at) < now) {
        request.status = 'EXPIRED';
        request.updated_at = now.toISOString();
        this.requests.set(request.id, request);
      }

      if (status === undefined || request.status === status) {
        results.push({ ...request });
      }
    }

    return results.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest | null> {
    const request = this.requests.get(id);
    if (!request) return null;

    request.status = status;
    request.updated_at = new Date().toISOString();
    this.requests.set(id, request);

    return { ...request };
  }

  async delete(id: string): Promise<boolean> {
    return this.requests.delete(id);
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    const expiredAge = 24 * 60 * 60 * 1000; // 24 hours
    let count = 0;

    for (const [id, request] of this.requests.entries()) {
      const updatedAt = new Date(request.updated_at);
      if (request.status !== 'PENDING' && now.getTime() - updatedAt.getTime() > expiredAge) {
        this.requests.delete(id);
        count++;
      }
    }

    return count;
  }
}
