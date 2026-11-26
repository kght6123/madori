import React, { useRef, useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTerminalAttach } from '../hooks/useTerminalManager';
import { DeadSessionView } from './DeadSessionView';

interface TerminalViewProps {
  sessionId: string;
}

export function TerminalView({ sessionId }: TerminalViewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const session = useSessionStore((s) => s.sessions.get(sessionId));
  const markRead = useSessionStore((s) => s.markRead);

  useTerminalAttach(sessionId, containerRef);

  // Mark read when terminal is focused
  const handleFocus = () => {
    if (session?.hasUnread) markRead(sessionId);
  };

  return (
    <div
      className={`
        relative w-full h-full
        ${session?.hasUnread ? 'terminal-container--notified' : ''}
      `}
      onFocus={handleFocus}
      onMouseDown={handleFocus}
    >
      {/* Terminal container — xterm.js DOM is injected here */}
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label={`Terminal for session ${session?.name ?? sessionId}`}
      />

      {/* Dead session overlay */}
      {session?.status === 'dead' && (
        <DeadSessionView session={session} />
      )}
    </div>
  );
}
