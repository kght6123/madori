import React, { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { api } from '../services/api';

export function MemoPanel(): React.ReactElement | null {
  const memoVisible = useSessionStore((s) => s.memoVisible);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const updateMemo = useSessionStore((s) => s.updateMemo);
  const hideMemo = useSessionStore((s) => s.hideMemo);

  const session = activeSessionId ? sessions.get(activeSessionId) : null;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync memo to server: on first activation (memoSynced = false) and on edit
  useEffect(() => {
    if (!session || !activeSessionId) return;
    if (!session.memoSynced && session.status === 'alive' && session.memo) {
      useSessionStore.getState().updateMetadata(activeSessionId, {});
      // Mark synced
      const store = useSessionStore.getState();
      const s = store.sessions.get(activeSessionId);
      if (s) {
        const updated = new Map(store.sessions);
        updated.set(activeSessionId, { ...s, memoSynced: true });
        store.setSessions(updated);
      }
      api.patchSession(activeSessionId, { memo: session.memo }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!activeSessionId) return;
      const memo = e.target.value;
      // Immediate localStorage save via store
      updateMemo(activeSessionId, memo);
      // Debounced server PATCH
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        api.patchSession(activeSessionId, { memo }).catch(() => {});
      }, 1000);
    },
    [activeSessionId, updateMemo]
  );

  if (!memoVisible) return null;

  return (
    <aside
      role="complementary"
      aria-label="Session memo"
      className="flex flex-col w-72 h-full bg-[var(--bg-secondary)] border-l border-[var(--border)] flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Memo{session ? `: ${session.name}` : ''}
        </h2>
        <button
          onClick={hideMemo}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Close memo panel"
        >
          ×
        </button>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-2">
        {session ? (
          <textarea
            value={session.memo}
            onChange={handleChange}
            placeholder="Session notes (auto-saved)..."
            className="w-full h-full resize-none bg-transparent text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] outline-none font-mono leading-relaxed"
            aria-label="Session memo"
          />
        ) : (
          <div className="text-center text-sm text-[var(--text-muted)] mt-4">
            Select a session to view its memo.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Auto-saved to localStorage (Ctrl+Shift+M to close)
        </span>
      </div>
    </aside>
  );
}
