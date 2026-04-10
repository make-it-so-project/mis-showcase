// Re-exports for programmatic use
export { ApprovalCoreClient } from './client.js';
export {
  TOOL_DEFINITIONS,
  createToolHandlers,
  requestApprovalSchema,
  checkStatusSchema,
  cancelApprovalSchema,
  listPendingSchema,
} from './tools.js';
