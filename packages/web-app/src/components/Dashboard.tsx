import React from 'react';
import type { ApprovalRequest, ApprovalResponse } from '@make-it-so/shared';
import { RequestCard } from './RequestCard';
import './Dashboard.css';

interface DashboardProps {
  requests: ApprovalRequest[];
  loading: boolean;
  error: string | null;
  onApprove: (id: string) => Promise<ApprovalResponse>;
  onDeny: (id: string) => Promise<ApprovalResponse>;
  onRefresh: () => Promise<void>;
}

export function Dashboard({
  requests,
  loading,
  error,
  onApprove,
  onDeny,
  onRefresh,
}: DashboardProps) {
  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const historyRequests = requests.filter((r) => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <span>Loading requests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-icon">⚠</div>
        <h2>Connection error</h2>
        <p>{error}</p>
        <button className="btn-retry" onClick={onRefresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <main className="dashboard">
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Pending Approvals</h2>
          <span className="request-count">{pendingRequests.length}</span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No pending approvals</p>
            <span className="empty-hint">
              New requests will appear here automatically
            </span>
          </div>
        ) : (
          <div className="request-grid">
            {pendingRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            ))}
          </div>
        )}
      </section>

      {historyRequests.length > 0 && (
        <section className="dashboard-section history">
          <div className="section-header">
            <h2>History</h2>
            <span className="request-count">{historyRequests.length}</span>
          </div>

          <div className="request-grid">
            {historyRequests.slice(0, 10).map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={onApprove}
                onDeny={onDeny}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
