import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClientSession } from '../types';

interface SessionState {
  sessions: Map<string, ClientSession>;
  activeSessionId: string | null;
  memoVisible: boolean;
  setActive: (id: string) => void;
  addSession: (session: ClientSession) => void;
  removeSession: (id: string) => void;
  updateMetadata: (
    id: string,
    meta: Partial<Pick<ClientSession, 'cwd' | 'gitBranch' | 'listeningPorts'>>
  ) => void;
  setNotification: (
    id: string,
    notif: { title: string; body: string; timestamp: number }
  ) => void;
  updateMemo: (id: string, memo: string) => void;
  updateSessionStatus: (id: string, status: 'alive' | 'dead', exitCode?: number) => void;
  markRead: (id: string) => void;
  toggleMemo: () => void;
  showMemo: () => void;
  hideMemo: () => void;
  setSessions: (sessions: Map<string, ClientSession>) => void;
}

type PersistedState = {
  sessions: Array<[string, ClientSession]>;
  activeSessionId: string | null;
  memoVisible: boolean;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: new Map(),
      activeSessionId: null,
      memoVisible: false,

      setActive: (id) => {
        set({ activeSessionId: id });
      },

      addSession: (session) => {
        set((state) => {
          const sessions = new Map(state.sessions);
          sessions.set(session.id, session);
          return { sessions };
        });
      },

      removeSession: (id) => {
        set((state) => {
          if (!state.sessions.has(id)) return state;
          const sessions = new Map(state.sessions);
          sessions.delete(id);
          const activeSessionId =
            state.activeSessionId === id
              ? (sessions.size > 0 ? [...sessions.keys()][0] : null)
              : state.activeSessionId;
          return { sessions, activeSessionId };
        });
      },

      updateMetadata: (id, meta) => {
        set((state) => {
          const session = state.sessions.get(id);
          if (!session) return state;
          const sessions = new Map(state.sessions);
          sessions.set(id, { ...session, ...meta });
          return { sessions };
        });
      },

      setNotification: (id, notif) => {
        set((state) => {
          const session = state.sessions.get(id);
          if (!session) return state;
          const sessions = new Map(state.sessions);
          sessions.set(id, { ...session, notification: notif, hasUnread: true });
          return { sessions };
        });
      },

      updateMemo: (id, memo) => {
        set((state) => {
          const session = state.sessions.get(id);
          if (!session) return state;
          const sessions = new Map(state.sessions);
          sessions.set(id, { ...session, memo });
          return { sessions };
        });
      },

      updateSessionStatus: (id, status, exitCode) => {
        set((state) => {
          const session = state.sessions.get(id);
          if (!session) return state;
          const sessions = new Map(state.sessions);
          sessions.set(id, {
            ...session,
            status,
            exitCode: exitCode !== undefined ? exitCode : session.exitCode,
          });
          return { sessions };
        });
      },

      markRead: (id) => {
        set((state) => {
          const session = state.sessions.get(id);
          if (!session) return state;
          const sessions = new Map(state.sessions);
          sessions.set(id, { ...session, hasUnread: false });
          return { sessions };
        });
      },

      toggleMemo: () => set((state) => ({ memoVisible: !state.memoVisible })),
      showMemo: () => set({ memoVisible: true }),
      hideMemo: () => set({ memoVisible: false }),

      setSessions: (sessions) => set({ sessions }),
    }),
    {
      name: 'madori:sessions',
      storage: {
        getItem: (name: string) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as { state: PersistedState; version: number };
            if (parsed?.state?.sessions && Array.isArray(parsed.state.sessions)) {
              (parsed.state as unknown as { sessions: Map<string, ClientSession> }).sessions =
                new Map(parsed.state.sessions as Array<[string, ClientSession]>);
            } else {
              (parsed.state as unknown as { sessions: Map<string, ClientSession> }).sessions =
                new Map();
            }
            return parsed as unknown as { state: SessionState; version: number };
          } catch {
            return null;
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setItem: (name: string, value: any) => {
          const serializable = {
            ...value,
            state: {
              ...value.state,
              sessions:
                value.state?.sessions instanceof Map
                  ? Array.from(value.state.sessions.entries())
                  : [],
            },
          };
          localStorage.setItem(name, JSON.stringify(serializable));
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      },
    }
  )
);

// Reconcile localStorage sessions with server sessions
export async function reconcileWithServer(
  serverSessions: Array<{
    id: string;
    name: string;
    cwd: string;
    gitBranch: string | null;
    listeningPorts: number[];
    notification: { title: string; body: string; timestamp: number } | null;
    hasUnread: boolean;
    memo: string;
    createdAt: number;
  }>
): Promise<void> {
  const store = useSessionStore.getState();
  const serverIds = new Set(serverSessions.map((s) => s.id));
  const localSessions = store.sessions;

  const merged = new Map<string, ClientSession>();

  // Add/update sessions from server
  for (const s of serverSessions) {
    const local = localSessions.get(s.id);
    merged.set(s.id, {
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      gitBranch: s.gitBranch,
      listeningPorts: s.listeningPorts,
      notification: s.notification,
      hasUnread: s.hasUnread,
      memo: local?.memo ?? s.memo,
      status: 'alive',
      exitCode: null,
      memoSynced: false,
      createdAt: s.createdAt,
    });
  }

  // Keep local-only sessions as dead
  for (const [id, session] of localSessions) {
    if (!serverIds.has(id)) {
      merged.set(id, { ...session, status: 'dead' });
    }
  }

  store.setSessions(merged);

  // Set active session if needed
  if (!store.activeSessionId || !merged.has(store.activeSessionId)) {
    const first = [...merged.keys()][0];
    if (first) store.setActive(first);
  }
}
