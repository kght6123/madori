import { create } from 'zustand';
import { NotificationEntry } from '../types';

const MAX_NOTIFICATIONS = 100;

interface NotificationState {
  notifications: NotificationEntry[];
  panelVisible: boolean;
  addNotification: (entry: NotificationEntry) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  togglePanel: () => void;
  showPanel: () => void;
  hidePanel: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  panelVisible: false,

  addNotification: (entry) => {
    set((state) => {
      const updated = [entry, ...state.notifications];
      if (updated.length > MAX_NOTIFICATIONS) updated.pop();
      return { notifications: updated };
    });
  },

  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),
  showPanel: () => set({ panelVisible: true }),
  hidePanel: () => set({ panelVisible: false }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
