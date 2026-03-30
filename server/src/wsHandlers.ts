import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import { URL } from 'url';
import { PtyManager } from './PtyManager';
import { EventBroadcaster } from './EventBroadcaster';
import { safeJsonParse } from './utils';

export class PtyConnectionManager {
  private connections = new Map<string, Set<WebSocket>>();

  add(sessionId: string, ws: WebSocket): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)!.add(ws);
  }

  remove(sessionId: string, ws: WebSocket): void {
    const set = this.connections.get(sessionId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.connections.delete(sessionId);
  }

  closeAll(sessionId: string): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;
    for (const ws of conns) {
      try { ws.close(); } catch { /* ignore */ }
    }
    this.connections.delete(sessionId);
  }

  broadcast(sessionId: string, frame: Buffer): void {
    const conns = this.connections.get(sessionId);
    if (!conns) return;
    for (const ws of conns) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(frame);
      } catch { /* ignore */ }
    }
  }
}

function handlePtySocket(
  ws: WebSocket,
  sessionId: string,
  ptyManager: PtyManager,
  ptyConnections: PtyConnectionManager
): void {
  const session = ptyManager.get(sessionId);
  if (!session) {
    ws.close(4004, 'Session not found');
    return;
  }

  ptyConnections.add(sessionId, ws);

  ws.on('message', (msg: Buffer) => {
    if (!Buffer.isBuffer(msg) || msg.length === 0) return;
    const type = msg[0];
    if (type === 0x00) {
      // Key input
      try {
        ptyManager.write(sessionId, msg.subarray(1));
      } catch { /* session may be gone */ }
    } else if (type === 0x01) {
      // Resize
      const jsonStr = msg.subarray(1).toString('utf8');
      const parsed = safeJsonParse<{ cols: number; rows: number }>(jsonStr);
      if (parsed && typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
        try {
          ptyManager.resize(sessionId, parsed.cols, parsed.rows);
        } catch { /* session may be gone */ }
      }
    }
  });

  ws.on('close', () => {
    ptyConnections.remove(sessionId, ws);
  });

  ws.on('error', () => {
    ptyConnections.remove(sessionId, ws);
  });
}

export function setupWebSocketServers(
  server: http.Server,
  ptyManager: PtyManager,
  broadcaster: EventBroadcaster
): PtyConnectionManager {
  const ptyConnections = new PtyConnectionManager();
  const ptyWss = new WebSocketServer({ noServer: true });
  const eventsWss = new WebSocketServer({ noServer: true });

  ptyWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const urlStr = req.url ?? '/';
    const url = new URL(urlStr, `http://${req.headers.host ?? 'localhost'}`);
    const match = url.pathname.match(/^\/ws\/pty\/(.+)$/);
    if (!match) {
      ws.close(4000, 'Invalid path');
      return;
    }
    const sessionId = match[1];
    handlePtySocket(ws, sessionId, ptyManager, ptyConnections);
  });

  eventsWss.on('connection', (ws: WebSocket) => {
    broadcaster.addClient(ws);
  });

  server.on('upgrade', (req: http.IncomingMessage, socket, head) => {
    const urlStr = req.url ?? '/';
    const url = new URL(urlStr, `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname.startsWith('/ws/pty/')) {
      ptyWss.handleUpgrade(req, socket, head, (ws) => {
        ptyWss.emit('connection', ws, req);
      });
    } else if (url.pathname === '/ws/events') {
      eventsWss.handleUpgrade(req, socket, head, (ws) => {
        eventsWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  return ptyConnections;
}
