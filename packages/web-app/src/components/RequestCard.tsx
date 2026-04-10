import React, { useState } from 'react';
import type { ApprovalRequest, ApprovalResponse } from '@make-it-so/shared';
import './RequestCard.css';

interface RequestCardProps {
  request: ApprovalRequest;
  onApprove: (id: string) => Promise<ApprovalResponse>;
  onDeny: (id: string) => Promise<ApprovalResponse>;
}

export function RequestCard({ request, onApprove, onDeny }: RequestCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApprovalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = request.status === 'PENDING';
  const expiresAt = new Date(request.expires_at);
  const createdAt = new Date(request.created_at);
  const now = new Date();
  const isExpired = expiresAt < now;
  const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await onApprove(request.id);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await onDeny(request.id);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Denial failed');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`request-card ${request.status.toLowerCase()}`}>
      <div className="request-header">
        <div className="request-type">
          <span className="type-icon">{getActionIcon(request.action_type)}</span>
          <span className="type-label">{request.action_type}</span>
        </div>
        <div className="request-status">
          <span className={`status-badge ${request.status.toLowerCase()}`}>
            {getStatusLabel(request.status)}
          </span>
        </div>
      </div>

      <div className="request-body">
        <p className="request-description">{request.description}</p>

        {request.metadata && Object.keys(request.metadata).length > 0 && (
          <div className="request-metadata">
            {request.metadata.amount !== undefined && (
              <div className="metadata-item">
                <span className="meta-label">Amount:</span>
                <span className="meta-value">
                  {request.metadata.amount} {request.metadata.currency ?? 'EUR'}
                </span>
              </div>
            )}
            {request.metadata.recipient && (
              <div className="metadata-item">
                <span className="meta-label">Recipient:</span>
                <span className="meta-value">{request.metadata.recipient as string}</span>
              </div>
            )}
          </div>
        )}

        {request.requires_2fa && (
          <div className="request-2fa-notice">
            <span className="notice-icon">🔐</span>
            <span>This action requires a 2FA code</span>
          </div>
        )}
      </div>

      <div className="request-footer">
        <div className="request-timing">
          <span className="timing-created">
            Created: {createdAt.toLocaleTimeString()}
          </span>
          {isPending && !isExpired && (
            <span className={`timing-expires ${timeLeft < 60 ? 'urgent' : ''}`}>
              Expires in: {formatTime(timeLeft)}
            </span>
          )}
        </div>

        {isPending && !isExpired && !result && (
          <div className="request-actions">
            <button
              className="btn btn-deny"
              onClick={handleDeny}
              disabled={loading}
            >
              {loading ? '...' : 'Deny'}
            </button>
            <button
              className="btn btn-approve"
              onClick={handleApprove}
              disabled={loading}
            >
              {loading ? '...' : 'Make it so!'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="request-error">
          <span className="error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {result && result.action_credential && (
        <div className="request-credential">
          <div className="credential-header">
            <span className="credential-icon">🔑</span>
            <span>Action Code</span>
          </div>
          <div className="credential-value">
            {result.action_credential.value}
          </div>
          <div className="credential-expires">
            Valid until: {new Date(result.action_credential.expires_at).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

function getActionIcon(actionType: string): string {
  const icons: Record<string, string> = {
    bank_transfer: '💸',
    contract_sign: '📝',
    booking: '🎫',
    system_change: '⚙️',
    data_access: '🔓',
  };
  return icons[actionType] ?? '📋';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    DENIED: 'Denied',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  };
  return labels[status] ?? status;
}
