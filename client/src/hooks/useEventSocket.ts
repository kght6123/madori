import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useNotificationStore } from '../stores/notificationStore';
import { ClientSession, NotificationEntry } from '../types';

interface EventMessage {
  event: string;
  [key: string]: unknown;
}

export function useEventSocket(): void {
  const reconnectDelay = useRef(1000);
  const wsRef = useRef<WebSocket | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/events`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (e: MessageEvent<string>) => {
        let msg: EventMessage;
        try {
          msg = JSON.parse(e.data) as EventMessage;
        } catch {
          return;
        }

        const sessionStore = useSessionStore.getState();
        const notifStore = useNotificationStore.getState();

        switch (msg.event) {
          case 'notification': {
            const entry: NotificationEntry = {
              id: Math.random().toString(36).slice(2),
              sessionId: msg.sessionId as string,
              sessionName: msg.sessionName as string,
              title: msg.title as string,
              body: msg.body as string,
              timestamp: msg.timestamp as number,
              read: false,
            };
            notifStore.addNotification(entry);
            sessionStore.setNotification(msg.sessionId as string, {
              title: msg.title as string,
              body: msg.body as string,
              timestamp: msg.timestamp as number,
            });
            break;
          }

          case 'metadata': {
            sessionStore.updateMetadata(msg.sessionId as string, {
              cwd: msg.cwd as string,
              gitBranch: msg.gitBranch as string | null,
              listeningPorts: msg.listeningPorts as number[],
            });
            break;
          }

          case 'session.exited': {
            sessionStore.updateSessionStatus(
              msg.sessionId as string,
              'dead',
              msg.exitCode as number
            );
            break;
          }

          case 'session.created': {
            const s = msg.session as {
              id: string;
              name: string;
              cwd: string;
              memo: string;
              createdAt: number;
            };
            if (!sessionStore.sessions.has(s.id)) {
              const newSession: ClientSession = {
                id: s.id,
                name: s.name,
                cwd: s.cwd,
                gitBranch: null,
                listeningPorts: [],
                notification: null,
                hasUnread: false,
                memo: s.memo,
                status: 'alive',
                exitCode: null,
                memoSynced: false,
                createdAt: s.createdAt,
              };
              sessionStore.addSession(newSession);
            }
            break;
          }

          case 'session.deleted': {
            sessionStore.removeSession(msg.sessionId as string);
            break;
          }
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (unmounted.current) return;
        if (event.code === 4004) return;
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 30000);
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      wsRef.current?.close();
    };
  }, []);
}
