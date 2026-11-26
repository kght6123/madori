import React, { useState, useRef, useEffect } from 'react';
import { ClientSession } from '../types';

interface SidebarTabProps {
  session: ClientSession;
  isActive: boolean;
  index: number;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function SidebarTab({
  session,
  isActive,
  index,
  onActivate,
  onDelete,
  onRename,
}: SidebarTabProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue(session.name);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(session.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  };

  const isDead = session.status === 'dead';
  const hasMemo = session.memo.trim().length > 0;

  const shortMetadata = [
    session.gitBranch ? `${session.gitBranch}` : null,
    session.listeningPorts.length > 0 ? session.listeningPorts.map((p) => `:${p}`).join(' ') : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      title={`${session.name} (Alt+${index + 1})`}
      className={`
        relative group flex flex-col px-3 py-2 cursor-pointer select-none
        border-l-2 transition-colors duration-100 outline-none
        ${isActive
          ? 'border-l-[var(--accent)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
          : 'border-l-transparent hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
        }
        ${isDead ? 'opacity-60' : ''}
      `}
      onClick={() => onActivate(session.id)}
      onDoubleClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(session.id); }
        if (e.key === 'Delete' || e.key === 'F2') { e.preventDefault(); if (e.key === 'F2') startEdit(); else onDelete(session.id); }
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Status indicator */}
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${isDead ? 'bg-[var(--text-muted)]' : 'bg-[var(--success)]'}`}
          aria-hidden="true"
        />

        {/* Session name */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm px-1 rounded outline outline-1 outline-[var(--accent)]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium truncate">
            {session.name}
          </span>
        )}

        {/* Unread indicator */}
        {session.hasUnread && (
          <span
            className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--notification)] animate-pulse"
            aria-label="unread notification"
          />
        )}

        {/* Memo indicator */}
        {hasMemo && (
          <span className="flex-shrink-0 text-xs text-[var(--text-muted)]" title="Has memo">📝</span>
        )}

        {/* Delete button */}
        <button
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-opacity ml-auto"
          onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(session.id); } }}
          aria-label={`Delete session ${session.name}`}
          title="Delete session"
          tabIndex={isActive ? 0 : -1}
        >
          ×
        </button>
      </div>

      {/* Metadata row */}
      <div className="mt-0.5 ml-3.5 text-xs text-[var(--text-muted)] truncate">
        {isDead ? (
          <span>Session ended{session.exitCode !== null ? ` (exit ${session.exitCode})` : ''}</span>
        ) : (
          <span>
            {session.cwd.replace(process.env.HOME ?? '/root', '~')}
            {shortMetadata ? ` • ${shortMetadata}` : ''}
          </span>
        )}
      </div>

      {/* Notification text */}
      {session.notification && session.hasUnread && (
        <div className="mt-0.5 ml-3.5 text-xs text-[var(--notification)] truncate">
          ⚡ {session.notification.title}: {session.notification.body}
        </div>
      )}
    </div>
  );
}
