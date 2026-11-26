import React, { useEffect, useState } from 'react';
import { useSessionStore, reconcileWithServer } from './stores/sessionStore';
import { useNotificationStore } from './stores/notificationStore';
import { useEventSocket } from './hooks/useEventSocket';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTerminalManager } from './hooks/useTerminalManager';
import { Sidebar } from './components/Sidebar';
import { TerminalView } from './components/TerminalView';
import { NotificationPanel } from './components/NotificationPanel';
import { MemoPanel } from './components/MemoPanel';
import { api } from './services/api';

function EmptyState(): React.ReactElement {
  const [creating, setCreating] = useState(false);
  const addSession = useSessionStore((s) => s.addSession);
  const setActive = useSessionStore((s) => s.setActive);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const session = await api.createSession();
      addSession({
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
      });
      setActive(session.id);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-muted)]">
      <div className="text-4xl">⊞</div>
      <div className="text-lg font-semibold text-[var(--text-secondary)]">No active session</div>
      <p className="text-sm text-center max-w-xs">
        Create a new terminal session to get started.
      </p>
      <button
        onClick={handleCreate}
        disabled={creating}
        className="px-4 py-2 rounded bg-[var(--accent)] text-[#1a1b26] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {creating ? 'Creating...' : '+ New Session'}
      </button>
      <div className="text-xs text-[var(--text-muted)]">or press Ctrl+Shift+N</div>
    </div>
  );
}

export function App(): React.ReactElement {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const memoVisible = useSessionStore((s) => s.memoVisible);
  const panelVisible = useNotificationStore((s) => s.panelVisible);
  const terminalManager = useTerminalManager();

  useEventSocket();
  useKeyboardShortcuts();

  // Load initial sessions from server
  useEffect(() => {
    api.getSessions().then((sessions) => {
      reconcileWithServer(sessions);
    }).catch((err) => {
      console.error('Failed to load sessions:', err);
    });
  }, []);

  const handleTerminalDispose = (id: string) => {
    terminalManager.dispose(id);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <Sidebar onTerminalDispose={handleTerminalDispose} />

      {/* Main content area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Terminal area */}
        <div className="flex-1 overflow-hidden">
          {activeSessionId ? (
            <TerminalView key={activeSessionId} sessionId={activeSessionId} />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Notification panel */}
        {panelVisible && <NotificationPanel />}

        {/* Memo panel */}
        {memoVisible && <MemoPanel />}
      </main>
    </div>
  );
}
