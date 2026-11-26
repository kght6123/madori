import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useNotificationStore } from '../stores/notificationStore';
import { api } from '../services/api';
import { ClientSession } from '../types';

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const sessionStore = useSessionStore.getState();
      const notifStore = useNotificationStore.getState();

      // Ctrl+Shift+N — New session
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        try {
          const session = await api.createSession();
          const clientSession: ClientSession = {
            id: session.id,
            name: session.name,
            cwd: session.cwd,
            gitBranch: null,
            listeningPorts: [],
            notification: null,
            hasUnread: false,
            memo: session.memo,
            status: 'alive',
            exitCode: null,
            memoSynced: false,
            createdAt: session.createdAt,
          };
          sessionStore.addSession(clientSession);
          sessionStore.setActive(session.id);
        } catch (err) {
          console.error('Failed to create session:', err);
        }
        return;
      }

      // Ctrl+Shift+W — Delete active session
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        const { activeSessionId } = sessionStore;
        if (activeSessionId) {
          try {
            await api.deleteSession(activeSessionId);
            sessionStore.removeSession(activeSessionId);
          } catch (err) {
            console.error('Failed to delete session:', err);
          }
        }
        return;
      }

      // Ctrl+Shift+M — Toggle memo
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        sessionStore.toggleMemo();
        return;
      }

      // Ctrl+Shift+I — Toggle notification panel
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        notifStore.togglePanel();
        return;
      }

      // Ctrl+Shift+U — Jump to first unread session
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        const unreadSession = [...sessionStore.sessions.values()].find((s) => s.hasUnread);
        if (unreadSession) {
          sessionStore.setActive(unreadSession.id);
          sessionStore.markRead(unreadSession.id);
        }
        return;
      }

      // Alt+1~9 — Switch session by index
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          const sessions = [...sessionStore.sessions.values()];
          const target = sessions[num - 1];
          if (target) sessionStore.setActive(target.id);
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
