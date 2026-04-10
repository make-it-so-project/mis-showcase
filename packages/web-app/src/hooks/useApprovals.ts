import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApprovalRequest, ApprovalResponse, WebSocketMessage } from '@make-it-so/shared';

const API_BASE = '/api';
const WS_BASE = `ws://${window.location.hostname}:4000/ws`;

interface UseApprovalsResult {
  requests: ApprovalRequest[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  approve: (id: string) => Promise<ApprovalResponse>;
  deny: (id: string) => Promise<ApprovalResponse>;
  refresh: () => Promise<void>;
}

export function useApprovals(userRef: string): UseApprovalsResult {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/requests?user_ref=${encodeURIComponent(userRef)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      const data = await response.json() as { requests: ApprovalRequest[] };
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userRef]);

  const approve = useCallback(async (id: string): Promise<ApprovalResponse> => {
    const response = await fetch(`${API_BASE}/requests/${id}/approve`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to approve');
    }
    const data = await response.json() as ApprovalResponse;
    await fetchRequests();
    return data;
  }, [fetchRequests]);

  const deny = useCallback(async (id: string): Promise<ApprovalResponse> => {
    const response = await fetch(`${API_BASE}/requests/${id}/deny`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to deny');
    }
    const data = await response.json() as ApprovalResponse;
    await fetchRequests();
    return data;
  }, [fetchRequests]);

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        // Subscribe to user_ref
        ws.send(JSON.stringify({ type: 'subscribe', user_ref: userRef }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('[WS] Message:', message);

          if (message.type === 'new_request' || message.type === 'status_changed') {
            fetchRequests();
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnected(false);
        // Auto-reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    };

    connect();
    fetchRequests();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userRef, fetchRequests]);

  return {
    requests,
    loading,
    error,
    connected,
    approve,
    deny,
    refresh: fetchRequests,
  };
}
