export interface ClientSession {
  id: string;
  name: string;
  cwd: string;
  gitBranch: string | null;
  listeningPorts: number[];
  notification: { title: string; body: string; timestamp: number } | null;
  hasUnread: boolean;
  memo: string;
  status: 'alive' | 'dead';
  exitCode: number | null;
  memoSynced: boolean;
  createdAt: number;
}

export interface NotificationEntry {
  id: string;
  sessionId: string;
  sessionName: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export interface ApiSession {
  id: string;
  name: string;
  cwd: string;
  gitBranch: string | null;
  listeningPorts: number[];
  notification: { title: string; body: string; timestamp: number } | null;
  hasUnread: boolean;
  memo: string;
  createdAt: number;
}
