# Architecture Overview — mis-showcase

> **Note:** This document describes the architecture of the early-stage showcase prototype.
> It does not reflect the full target architecture defined in
> [mis-docs](https://github.com/make-it-so-project/mis-docs).

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AI Agent                             │
│          (e.g. Claude, Cursor, any MCP client)              │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP (stdio or HTTP/SSE)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                              │
│   Tools: request_approval, check_approval_status,           │
│          cancel_approval, list_pending_approvals            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Approval Core                             │
│   REST API (port 4000) + WebSocket (/ws)                    │
│   In-memory request store                                   │
│   One-time credential generator (optional 2FA)             │
└────────────┬──────────────────────────┬────────────────────┘
             │ WebSocket (real-time)    │ HTTP REST
             ▼                         ▼
┌────────────────────┐      ┌──────────────────────┐
│     Web App        │      │        CLI            │
│  React / Vite      │      │  commander + chalk    │
│  (port 3000)       │      │  make-it-so <cmd>     │
└────────────────────┘      └──────────────────────┘
```

---

## Packages

### `shared`

TypeScript type definitions and constants shared across all packages.

Key exports:
- `ApprovalRequest` — full request object including status, timestamps
- `CreateApprovalRequest` — input shape for new requests
- `ApprovalResponse` — response with optional `approval_token` and `action_credential`
- `ApprovalStatus` — `PENDING | APPROVED | DENIED | EXPIRED | CANCELLED`
- `ActionCredential` — one-time code returned on approval with 2FA
- `DEFAULT_CONFIG` — port numbers, TTL defaults
- `API_ENDPOINTS` — endpoint path constants
- `ERROR_CODES` — standardized error code strings

---

### `approval-core`

Express HTTP server that manages the approval lifecycle.

**REST API:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/requests` | Create a new approval request |
| `GET` | `/api/requests?user_ref=&status=` | List requests for a user |
| `GET` | `/api/requests/:id` | Get status of a single request |
| `POST` | `/api/requests/:id/approve` | Approve a request |
| `POST` | `/api/requests/:id/deny` | Deny a request |
| `POST` | `/api/requests/:id/cancel` | Cancel a pending request |
| `GET` | `/health` | Health check |

**WebSocket (`/ws`):**

Clients subscribe to a `user_ref` and receive push notifications:
- `new_request` — a new request was created for this user
- `status_changed` — a request changed status
- `request_expired` — a request expired

**Storage:**

`InMemoryStore` — all data is held in memory. Requests older than 24 hours are
purged by a cleanup job that runs every 5 minutes.

**Credentials:**

`CredentialGenerator` produces cryptographically random numeric codes (default: 6 digits)
with a configurable TTL (default: 60 seconds). Each code can only be used once.

---

### `mcp-server`

MCP adapter that exposes the approval workflow as MCP tools.

Two transport modes:
- **stdio** (`src/stdio.ts`) — for Cursor, Claude Desktop, and other local MCP hosts
- **HTTP/SSE** (`src/http.ts`) — for remote or web-based MCP hosts (port 5000)

The `ApprovalCoreClient` handles all HTTP communication with `approval-core`.

---

### `web-app`

React SPA built with Vite. Proxies `/api` and `/ws` to `approval-core` at port 4000.

Key components:
- `Header` — user ref input and WebSocket connection status
- `Dashboard` — pending requests grid and history list
- `RequestCard` — individual request with approve / deny actions and 2FA code display

The `useApprovals` hook manages:
- Initial data fetch on mount and on user ref change
- WebSocket subscription for real-time updates
- Auto-reconnect on disconnect (3-second backoff)

---

### `cli`

Node.js CLI built with `commander`. Connects to `approval-core` via HTTP polling.

Commands:
- `list -u <user_ref>` — show pending requests
- `show <id>` — show request details
- `approve <id>` — approve (alias: `makeitso`)
- `deny <id>` — deny
- `watch -u <user_ref>` — poll for new requests every N seconds

---

## Request Lifecycle

```
Agent                MCP Server          Approval Core       Human
  │                      │                     │               │
  │ request_approval(…)  │                     │               │
  ├─────────────────────►│                     │               │
  │                      │ POST /api/requests  │               │
  │                      ├────────────────────►│               │
  │                      │ { request_id, … }   │               │
  │                      │◄────────────────────┤               │
  │ { request_id }       │                     │               │
  │◄─────────────────────┤                     │  WS push      │
  │                      │                     ├──────────────►│
  │                      │                     │               │ (reviews)
  │ check_approval_status│                     │               │
  ├─────────────────────►│                     │               │
  │  (polls until decided)                     │               │
  │                      │ GET /api/requests/:id               │
  │                      ├────────────────────►│               │
  │                      │                     │ POST /approve │
  │                      │                     │◄──────────────┤
  │                      │ { APPROVED, token } │               │
  │                      │◄────────────────────┤               │
  │ { APPROVED, token }  │                     │               │
  │◄─────────────────────┤                     │               │
```

---

## Known Limitations (Showcase Scope)

- **In-memory only** — all data is lost on server restart
- **No authentication** — `user_ref` is a plain string, not verified
- **No policy engine** — every request goes directly to human review
- **No ADR-0002 compliance** — scoped session tokens not implemented
- **Single instance only** — no clustering or persistence layer
