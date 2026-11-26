import React from 'react';
import { ClientSession } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { useTerminalManager } from '../hooks/useTerminalManager';
import { api } from '../services/api';

interface DeadSessionViewProps {
  session: ClientSession;
}

export function DeadSessionView({ session }: DeadSessionViewProps): React.ReactElement {
  const removeSession = useSessionStore((s) => s.removeSession);
  const addSession = useSessionStore((s) => s.addSession);
  const setActive = useSessionStore((s) => s.setActive);
  const terminalManager = useTerminalManager();

  const handleRemove = () => {
    terminalManager.dispose(session.id);
    removeSession(session.id);
  };

  const handleNewSession = async () => {
    try {
      const newApiSession = await api.createSession({ name: session.name });
      // Copy memo to new session if any
      if (session.memo) {
        await api.patchSession(newApiSession.id, { memo: session.memo });
      }
      const newSession: ClientSession = {
        id: newApiSession.id,
        name: newApiSession.name,
        cwd: newApiSession.cwd,
        gitBranch: null,
        listeningPorts: [],
        notification: null,
        hasUnread: false,
        memo: session.memo,
        status: 'alive',
        exitCode: null,
        memoSynced: session.memo.length > 0,
        createdAt: newApiSession.createdAt,
      };
      // Remove old dead tab, add new one
      terminalManager.dispose(session.id);
      removeSession(session.id);
      addSession(newSession);
      setActive(newSession.id);
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-end justify-center pb-12 pointer-events-none z-10"
      role="status"
      aria-label="Session ended"
    >
      <div
        className="pointer-events-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 shadow-xl max-w-sm w-full mx-4"
      >
        <div className="text-center mb-3">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Session Ended</div>
          {session.exitCode !== null && (
            <div className="text-sm text-[var(--text-muted)]">
              Exit code: {session.exitCode}
            </div>
          )}
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Scrollback is preserved above.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleNewSession}
            className="flex-1 py-1.5 px-3 rounded bg-[var(--accent)] text-[#1a1b26] text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Start New Session
          </button>
          <button
            onClick={handleRemove}
            className="py-1.5 px-3 rounded border border-[var(--border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
