import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PtyManager } from './PtyManager';
import { EventBroadcaster } from './EventBroadcaster';
import { NotificationDetector } from './NotificationDetector';
import { PtyConnectionManager } from './wsHandlers';
import { config } from './config';

export interface NotificationEntry {
  id: string;
  sessionId: string;
  sessionName: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export class NotificationHistory {
  private entries: NotificationEntry[] = [];

  push(entry: NotificationEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > config.maxNotifications) {
      this.entries.pop();
    }
  }

  list(): NotificationEntry[] {
    return this.entries;
  }
}

export function setupPtyListeners(
  sessionId: string,
  ptyManager: PtyManager,
  detector: NotificationDetector,
  broadcaster: EventBroadcaster,
  ptyConnections: PtyConnectionManager,
  notificationHistory: NotificationHistory
): void {
  const pty = ptyManager.getPty(sessionId);
  const session = ptyManager.get(sessionId);
  if (!pty || !session) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pty as any).onData((data: Buffer) => {
    // Detect notifications
    detector.feed(sessionId, data);

    // Forward raw PTY output to all connected WebSocket clients
    const frame = Buffer.alloc(data.length + 1);
    frame[0] = 0x00;
    data.copy(frame, 1);
    ptyConnections.broadcast(sessionId, frame);
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
    broadcaster.send({ event: 'session.exited', sessionId, exitCode });
    ptyConnections.closeAll(sessionId);
    detector.clear(sessionId);
    ptyManager.kill(sessionId);
  });
}

export function createRouter(
  ptyManager: PtyManager,
  broadcaster: EventBroadcaster,
  detector: NotificationDetector,
  ptyConnections: PtyConnectionManager,
  notificationHistory: NotificationHistory
): Router {
  const router = Router();

  // GET /api/sessions
  router.get('/sessions', (_req: Request, res: Response) => {
    const sessions = ptyManager.list().map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      gitBranch: s.gitBranch,
      listeningPorts: s.listeningPorts,
      notification: s.notification,
      hasUnread: s.hasUnread,
      memo: s.memo,
      createdAt: s.createdAt,
    }));
    res.json({ sessions });
  });

  // POST /api/sessions
  router.post('/sessions', (req: Request, res: Response) => {
    const { name, cwd } = req.body as { name?: string; cwd?: string };
    try {
      const session = ptyManager.create({ name, cwd });
      setupPtyListeners(
        session.id,
        ptyManager,
        detector,
        broadcaster,
        ptyConnections,
        notificationHistory
      );

      // Wire up notification callback result to history + broadcaster
      // (callback is already set in NotificationDetector constructor)

      broadcaster.send({
        event: 'session.created',
        session: {
          id: session.id,
          name: session.name,
          cwd: session.cwd,
          memo: session.memo,
          createdAt: session.createdAt,
        },
      });

      res.status(201).json({
        session: {
          id: session.id,
          name: session.name,
          cwd: session.cwd,
          memo: session.memo,
          createdAt: session.createdAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  // DELETE /api/sessions/:id
  router.delete('/sessions/:id', (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    if (!ptyManager.has(id)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    ptyConnections.closeAll(id);
    detector.clear(id);
    ptyManager.kill(id);
    broadcaster.send({ event: 'session.deleted', sessionId: id });
    res.status(204).send();
  });

  // PATCH /api/sessions/:id
  router.patch('/sessions/:id', (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const session = ptyManager.get(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const { name, memo } = req.body as { name?: string; memo?: string };
    if (name !== undefined) ptyManager.updateName(id, name);
    if (memo !== undefined) ptyManager.updateMemo(id, memo);
    const updated = ptyManager.get(id)!;
    res.json({
      session: {
        id: updated.id,
        name: updated.name,
        cwd: updated.cwd,
        memo: updated.memo,
        createdAt: updated.createdAt,
      },
    });
  });

  // GET /api/notifications
  router.get('/notifications', (_req: Request, res: Response) => {
    res.json({ notifications: notificationHistory.list() });
  });

  return router;
}
