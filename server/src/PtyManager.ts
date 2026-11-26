import * as pty from 'node-pty';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

export interface ServerSession {
  id: string;
  name: string;
  pid: number;
  shell: string;
  cols: number;
  rows: number;
  createdAt: number;
  cwd: string;
  gitBranch: string | null;
  listeningPorts: number[];
  notification: { title: string; body: string; timestamp: number } | null;
  hasUnread: boolean;
  memo: string;
}

interface SessionEntry {
  session: ServerSession;
  pty: pty.IPty;
}

export interface CreateSessionOpts {
  name?: string;
  cwd?: string;
}

export class PtyManager {
  private sessions = new Map<string, SessionEntry>();
  private sessionCounter = 0;

  create(opts: CreateSessionOpts = {}): ServerSession {
    this.sessionCounter++;

    let cwd: string;
    if (opts.cwd) {
      const resolved = path.resolve(opts.cwd);
      try {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
          throw new Error(`Not a directory: ${resolved}`);
        }
        cwd = resolved;
      } catch {
        throw new Error(`Invalid cwd: ${opts.cwd}`);
      }
    } else {
      cwd = process.env.HOME ?? process.cwd();
    }

    const name = opts.name ?? `Session ${this.sessionCounter}`;
    const id = uuidv4();

    const ptyProcess = pty.spawn(config.shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
      encoding: null,
    } as pty.IPtyForkOptions);

    const session: ServerSession = {
      id,
      name,
      pid: ptyProcess.pid,
      shell: config.shell,
      cols: 80,
      rows: 24,
      createdAt: Date.now(),
      cwd,
      gitBranch: null,
      listeningPorts: [],
      notification: null,
      hasUnread: false,
      memo: '',
    };

    this.sessions.set(id, { session, pty: ptyProcess });
    return session;
  }

  getPty(id: string): pty.IPty | undefined {
    return this.sessions.get(id)?.pty;
  }

  get(id: string): ServerSession | undefined {
    return this.sessions.get(id)?.session;
  }

  list(): ServerSession[] {
    return Array.from(this.sessions.values()).map((e) => e.session);
  }

  write(id: string, data: Buffer | string): void {
    const entry = this.sessions.get(id);
    if (!entry) throw new Error(`Session not found: ${id}`);
    entry.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const entry = this.sessions.get(id);
    if (!entry) throw new Error(`Session not found: ${id}`);
    entry.pty.resize(cols, rows);
    entry.session.cols = cols;
    entry.session.rows = rows;
  }

  kill(id: string): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    try {
      entry.pty.kill();
    } catch {
      // already dead
    }
    this.sessions.delete(id);
  }

  updateMemo(id: string, memo: string): void {
    const entry = this.sessions.get(id);
    if (entry) entry.session.memo = memo;
  }

  updateName(id: string, name: string): void {
    const entry = this.sessions.get(id);
    if (entry) entry.session.name = name;
  }

  updateMetadata(
    id: string,
    meta: Partial<Pick<ServerSession, 'cwd' | 'gitBranch' | 'listeningPorts'>>
  ): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    if (meta.cwd !== undefined) entry.session.cwd = meta.cwd;
    if (meta.gitBranch !== undefined) entry.session.gitBranch = meta.gitBranch;
    if (meta.listeningPorts !== undefined) entry.session.listeningPorts = meta.listeningPorts;
  }

  setNotification(
    id: string,
    notification: { title: string; body: string; timestamp: number }
  ): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    entry.session.notification = notification;
    entry.session.hasUnread = true;
  }

  markRead(id: string): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    entry.session.hasUnread = false;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }
}
