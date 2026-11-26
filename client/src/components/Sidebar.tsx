import React, { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useNotificationStore } from '../stores/notificationStore';
import { SidebarTab } from './SidebarTab';
import { NotificationRing } from './NotificationRing';
import { api } from '../services/api';
import { ClientSession } from '../types';

interface SidebarProps {
  onTerminalDispose: (id: string) => void;
}

export function Sidebar({ onTerminalDispose }: SidebarProps): React.ReactElement {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActive);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const togglePanel = useNotificationStore((s) => s.togglePanel);

  const [creating, setCreating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
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
      addSession(clientSession);
      setActive(session.id);
      setMobileOpen(false);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const session = sessions.get(id);
      if (session?.status === 'alive') {
        await api.deleteSession(id);
      }
      onTerminalDispose(id);
      removeSession(id);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await api.patchSession(id, { name });
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
    // Update locally regardless
    const session = sessions.get(id);
    if (session) {
      useSessionStore.getState().updateMetadata(id, {});
      // Direct update via store
      const store = useSessionStore.getState();
      const s = store.sessions.get(id);
      if (s) {
        const updated = new Map(store.sessions);
        updated.set(id, { ...s, name });
        store.setSessions(updated);
      }
    }
  };

  const sessionList = [...sessions.values()];

  const sidebarContent = (
    <nav
      className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border)]"
      aria-label="Sessions"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text-primary)]">madori</span>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-[#1a1b26] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          aria-label="New session (Ctrl+Shift+N)"
          title="New session (Ctrl+Shift+N)"
        >
          + New
        </button>
      </div>

      {/* Session list */}
      <div
        role="tablist"
        aria-label="Sessions"
        aria-orientation="vertical"
        className="flex-1 overflow-y-auto"
      >
        {sessionList.length === 0 ? (
          <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
            No sessions.<br />Click "+ New" to start.
          </div>
        ) : (
          sessionList.map((session, i) => (
            <SidebarTab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              index={i}
              onActivate={setActive}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))
        )}
      </div>

      {/* Footer: notification bell */}
      <div className="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between">
        <NotificationRing count={unreadCount} onClick={togglePanel} />
        <span className="text-xs text-[var(--text-muted)]">
          {sessionList.filter((s) => s.status === 'alive').length} alive
        </span>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-2 left-2 z-50 p-2 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: always visible lg+, drawer on mobile */}
      <div
        className={`
          lg:relative lg:flex lg:w-56 flex-shrink-0
          ${mobileOpen
            ? 'fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col'
            : 'hidden lg:flex flex-col'
          }
          h-full
        `}
      >
        {sidebarContent}
      </div>
    </>
  );
}
