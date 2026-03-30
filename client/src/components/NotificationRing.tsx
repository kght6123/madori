import React from 'react';

interface NotificationRingProps {
  count: number;
  onClick: () => void;
}

export function NotificationRing({ count, onClick }: NotificationRingProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      title="Notifications (Ctrl+Shift+I)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span
          role="status"
          aria-live="polite"
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-[var(--notification)] text-white rounded-full"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
