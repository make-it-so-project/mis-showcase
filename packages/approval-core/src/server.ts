import express, { Application } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { DEFAULT_CONFIG } from '@make-it-so/shared';
import { InMemoryStore } from './store.js';
import { CredentialGenerator } from './credentials.js';
import { WebSocketManager } from './websocket.js';
import { createRouter } from './routes.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : DEFAULT_CONFIG.APPROVAL_CORE_PORT;

// Initialize dependencies
const store = new InMemoryStore();
const credentialGenerator = new CredentialGenerator(
  DEFAULT_CONFIG.CREDENTIAL_LENGTH,
  DEFAULT_CONFIG.CREDENTIAL_TTL_SECONDS
);
const wsManager = new WebSocketManager();

// Create Express app
const app: Application = express();
app.use(cors());
app.use(express.json());

// Mount API router
const apiRouter = createRouter({ store, credentialGenerator, wsManager });
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
wsManager.attach(server);

// Cleanup job for expired requests (every 5 minutes)
setInterval(async () => {
  const cleaned = await store.cleanup();
  if (cleaned > 0) {
    console.log(`[Cleanup] Removed ${cleaned} old requests`);
  }
}, 5 * 60 * 1000);

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Make It So - Approval Core                       ║
║                                                       ║
║   HTTP API:    http://localhost:${PORT}/api             ║
║   WebSocket:   ws://localhost:${PORT}/ws                ║
║   Health:      http://localhost:${PORT}/health          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down...');
  wsManager.close();
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] Received SIGINT, shutting down...');
  wsManager.close();
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

export { app, server };
