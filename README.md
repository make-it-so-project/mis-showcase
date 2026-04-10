# mis-showcase

> **Early-Stage Showcase** — This repository is a minimal proof-of-concept prototype of the
> [make-it-so](https://github.com/make-it-so-project) platform. It was created to demonstrate
> the core idea and is **not** aligned with the current architecture decisions documented in
> [mis-docs](https://github.com/make-it-so-project/mis-docs). Treat it as a working sketch,
> not a reference implementation.

---

A platform-neutral approval infrastructure for AI agents, enabling human authorization of
security-critical actions via MCP (Model Context Protocol).

```
AI Agent  →  MCP Server  →  Approval Core  →  Web App / CLI  →  Human
```

## Concept

AI agents can prepare complex tasks, but should not autonomously execute irreversible actions.
This showcase provides:

- **`request_approval`** — agent submits an action request for human review
- **`check_approval_status`** — agent polls for the decision
- **Human decision** — via web app or CLI ("Make it so!")
- **Optional one-time credentials** — e.g. 2FA codes for high-risk actions

## Package Structure

```
packages/
├── shared/          # Shared TypeScript types and constants
├── approval-core/   # Express backend — REST API + WebSocket (port 4000)
├── mcp-server/      # MCP adapter — stdio and HTTP/SSE transports (port 5000)
├── web-app/         # React frontend (port 3000)
└── cli/             # Command-line tool
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Installation

```bash
pnpm install
pnpm build
```

## Quick Start

### 1. Start the Approval Core (backend)

```bash
cd packages/approval-core
pnpm dev
# Running at http://localhost:4000
```

### 2. Start the Web App (frontend)

```bash
cd packages/web-app
pnpm dev
# Running at http://localhost:3000
```

### 3. Configure the MCP Server

Copy `mcp-config.example.json` and adjust the path.

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "make-it-so": {
      "command": "node",
      "args": ["/path/to/mis-showcase/packages/mcp-server/dist/stdio.js"],
      "env": {
        "APPROVAL_CORE_URL": "http://localhost:4000"
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "make-it-so": {
      "command": "node",
      "args": ["/path/to/mis-showcase/packages/mcp-server/dist/stdio.js"]
    }
  }
}
```

## CLI Usage

```bash
# List all pending requests
make-it-so list -u demo-user

# Approve a request
make-it-so approve <request-id>

# Deny a request
make-it-so deny <request-id>

# Watch for new requests (polling)
make-it-so watch -u demo-user
```

## MCP Tools

### `request_approval`

Submits a request for human approval.

```typescript
{
  action_type: "bank_transfer",
  description: "Transfer €500 to Max Mustermann",
  user_ref: "user-123",
  metadata: {
    amount: 500,
    currency: "EUR",
    recipient: "Max Mustermann"
  },
  requires_2fa: true
}
```

### `check_approval_status`

Polls the status of a pending request.

```typescript
// Input
{ request_id: "abc-123" }

// Response on approval
{
  status: "APPROVED",
  approval_token: "xyz-789",
  action_credential: {
    type: "one_time_code",
    value: "483921",
    expires_at: "2026-01-14T19:45:30Z"
  }
}
```

### `cancel_approval`

Cancels a pending request.

### `list_pending_approvals`

Lists all pending requests for a given `user_ref`.

## Security Principles

1. **Explicit approval** — no implicit grants
2. **Human accountability** — the AI is only a tool
3. **Time-bounded requests** — requests expire automatically
4. **Audit trail** — all decisions are logged
5. **Optional 2FA** — one-time credentials for critical actions

## Demo

![mis-showcase demo](docs/screenshots/mis-showcase-demo.gif)

## Relationship to mis-docs

This showcase predates several architectural decisions recorded in
[mis-docs](https://github.com/make-it-so-project/mis-docs).
Notable gaps include:

- ADR-0002: Short-lived scoped session MCP authorization is not yet implemented
- Policy evaluation layer is absent — all requests go directly to human approval
- No persistent storage — the approval store is in-memory only

## License

MIT
