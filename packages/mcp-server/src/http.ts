#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { ApprovalCoreClient } from './client.js';
import {
  TOOL_DEFINITIONS,
  createToolHandlers,
  requestApprovalSchema,
  checkStatusSchema,
  cancelApprovalSchema,
  listPendingSchema,
} from './tools.js';

// Configuration from environment variables
const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : 5000;
const APPROVAL_CORE_URL = process.env.APPROVAL_CORE_URL ?? 'http://localhost:4000';

// Client for Approval Core
const client = new ApprovalCoreClient(APPROVAL_CORE_URL);
const handlers = createToolHandlers(client);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Active transports per session
const transports: Map<string, SSEServerTransport> = new Map();

// SSE endpoint for MCP connections
app.get('/sse', async (req, res) => {
  console.log('[MCP HTTP] New SSE connection');

  const transport = new SSEServerTransport('/messages', res);
  const sessionId = Math.random().toString(36).substring(7);
  transports.set(sessionId, transport);

  // Create MCP server instance for this connection
  const server = new Server(
    {
      name: 'make-it-so',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Expose tool list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'request_approval': {
          const parsed = requestApprovalSchema.parse(args);
          return await handlers.request_approval(parsed);
        }

        case 'check_approval_status': {
          const parsed = checkStatusSchema.parse(args);
          return await handlers.check_approval_status(parsed);
        }

        case 'cancel_approval': {
          const parsed = cancelApprovalSchema.parse(args);
          return await handlers.cancel_approval(parsed);
        }

        case 'list_pending_approvals': {
          const parsed = listPendingSchema.parse(args);
          return await handlers.list_pending_approvals(parsed);
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect transport
  await server.connect(transport);

  // Cleanup on disconnect
  res.on('close', () => {
    console.log('[MCP HTTP] SSE connection closed');
    transports.delete(sessionId);
  });
});

// Message endpoint for POST requests
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Make It So - MCP Server (HTTP/SSE)               ║
║                                                       ║
║   SSE Endpoint:  http://localhost:${PORT}/sse           ║
║   Messages:      http://localhost:${PORT}/messages      ║
║   Health:        http://localhost:${PORT}/health        ║
║                                                       ║
║   Approval Core: ${APPROVAL_CORE_URL.padEnd(26)}      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
