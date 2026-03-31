import React from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useSessionStore } from '../stores/sessionStore';
import { NotificationEntry } from '../types';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationPanel(): React.ReactElement | null {
  const panelVisible = useNotificationStore((s) => s.panelVisible);
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const hidePanel = useNotificationStore((s) => s.hidePanel);
  const setActive = useSessionStore((s) => s.setActive);

  if (!panelVisible) return null;

  // Group by sessionId
  const bySession = new Map<string, { sessionName: string; entries: NotificationEntry[] }>();
  for (const n of notifications) {
    if (!bySession.has(n.sessionId)) {
      bySession.set(n.sessionId, { sessionName: n.sessionName, entries: [] });
    }
    bySession.get(n.sessionId)!.entries.push(n);
  }

  const handleClick = (n: NotificationEntry) => {
    markRead(n.id);
    setActive(n.sessionId);
    hidePanel();
  };

  return (
    <aside
      role="complementary"
      aria-label="Notifications"
      className="flex flex-col w-80 h-full bg-[var(--bg-secondary)] border-l border-[var(--border)] flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Mark all read
          </button>
          <button
            onClick={hidePanel}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close notifications panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            No notifications yet.
          </div>
        ) : (
          [...bySession.entries()].map(([sessionId, { sessionName, entries }]) => (
            <div key={sessionId}>
              <div className="px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-tertiary)] sticky top-0">
                {sessionName}
              </div>
              {entries.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`
                    w-full text-left px-4 py-2.5 border-b border-[var(--border)]
                    hover:bg-[var(--bg-tertiary)] transition-colors
                    ${n.read ? 'opacity-60' : ''}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {n.title}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                  {n.body && (
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                      {n.body}
                    </div>
                  )}
                  {!n.read && (
                    <div className="mt-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--notification)]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
