import { WebSocket, WebSocketServer } from 'ws';
import { ApprovalRequest, WebSocketMessage } from '@make-it-so/shared';
import type { Server } from 'http';

interface ClientSubscription {
  ws: WebSocket;
  userRefs: Set<string>;
}

/**
 * WebSocket manager for real-time push notifications
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();

  /**
   * Attaches the WebSocket server to an existing HTTP server
   */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WS] Client connected');

      this.clients.set(ws, { ws, userRefs: new Set() });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(ws, message);
        } catch (err) {
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('[WS] Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WS] Error:', err);
        this.clients.delete(ws);
      });
    });

    console.log('[WS] WebSocket server attached');
  }

  /**
   * Handles incoming client messages
   */
  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.user_ref) {
          client.userRefs.add(message.user_ref);
          console.log(`[WS] Client subscribed to user_ref: ${message.user_ref}`);
        }
        break;

      case 'unsubscribe':
        if (message.user_ref) {
          client.userRefs.delete(message.user_ref);
          console.log(`[WS] Client unsubscribed from user_ref: ${message.user_ref}`);
        }
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Notifies all subscribed clients about a new request
   */
  notifyNewRequest(request: ApprovalRequest): void {
    this.broadcast(request.user_ref, {
      type: 'new_request',
      request_id: request.id,
      request,
    });
  }

  /**
   * Notifies all subscribed clients about a status change
   */
  notifyStatusChanged(request: ApprovalRequest): void {
    this.broadcast(request.user_ref, {
      type: 'status_changed',
      request_id: request.id,
      request,
    });
  }

  /**
   * Notifies all subscribed clients about an expired request
   */
  notifyExpired(request: ApprovalRequest): void {
    this.broadcast(request.user_ref, {
      type: 'request_expired',
      request_id: request.id,
      request,
    });
  }

  /**
   * Broadcasts a message to all clients subscribed to the given user_ref
   */
  private broadcast(userRef: string, message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.userRefs.has(userRef)) {
        this.send(client.ws, message);
      }
    }
  }

  /**
   * Sends a message to a single client
   */
  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Sends an error message to a client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, { type: 'error', error });
  }

  /**
   * Closes all connections
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }
}
