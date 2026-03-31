import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { config } from './config';
import { PtyManager } from './PtyManager';
import { NotificationDetector } from './NotificationDetector';
import { MetadataCollector } from './MetadataCollector';
import { EventBroadcaster } from './EventBroadcaster';
import { setupWebSocketServers } from './wsHandlers';
import {
  createRouter,
  NotificationHistory,
  setupPtyListeners,
} from './routes';

const app = express();
app.use(express.json());

const ptyManager = new PtyManager();
const broadcaster = new EventBroadcaster();
const notificationHistory = new NotificationHistory();

// NotificationDetector wires notifications into history + broadcaster
const detector = new NotificationDetector((sessionId, result) => {
  const session = ptyManager.get(sessionId);
  if (!session) return;
  const timestamp = Date.now();
  const entry = {
    id: Math.random().toString(36).slice(2),
    sessionId,
    sessionName: session.name,
    title: result.title,
    body: result.body,
    timestamp,
    read: false,
  };
  notificationHistory.push(entry);
  ptyManager.setNotification(sessionId, { title: result.title, body: result.body, timestamp });
  broadcaster.send({
    event: 'notification',
    sessionId,
    sessionName: session.name,
    title: result.title,
    body: result.body,
    timestamp,
  });
});

const server = http.createServer(app);
const ptyConnections = setupWebSocketServers(server, ptyManager, broadcaster);

// Metadata collection
const metadataCollector = new MetadataCollector();
metadataCollector.start(ptyManager, (sessionId, meta) => {
  broadcaster.send({ event: 'metadata', sessionId, ...meta });
});

// REST API
app.use(
  '/api',
  createRouter(ptyManager, broadcaster, detector, ptyConnections, notificationHistory)
);

// Serve client static files in production
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

server.listen(config.port, config.host, () => {
  console.log(`madori server listening on http://${config.host}:${config.port}`);
  console.log(`Shell: ${config.shell}`);
});

process.on('SIGTERM', () => {
  metadataCollector.stop();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  metadataCollector.stop();
  server.close();
  process.exit(0);
});
