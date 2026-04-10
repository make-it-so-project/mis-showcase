#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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
const APPROVAL_CORE_URL = process.env.APPROVAL_CORE_URL ?? 'http://localhost:4000';

// Client for Approval Core
const client = new ApprovalCoreClient(APPROVAL_CORE_URL);
const handlers = createToolHandlers(client);

// Create MCP server
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Make It So server started (stdio)');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
