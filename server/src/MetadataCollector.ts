import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PtyManager } from './PtyManager';
import { config } from './config';

const execAsync = promisify(exec);

export interface MetadataUpdate {
  cwd: string;
  gitBranch: string | null;
  listeningPorts: number[];
}

export class MetadataCollector {
  private intervalId: NodeJS.Timeout | null = null;

  start(
    ptyManager: PtyManager,
    onChange: (sessionId: string, meta: MetadataUpdate) => void
  ): void {
    this.intervalId = setInterval(async () => {
      for (const session of ptyManager.list()) {
        if (!ptyManager.has(session.id)) continue;
        try {
          const meta = await this.collect(session.pid, session.cwd);
          if (!ptyManager.has(session.id)) continue;
          const changed =
            meta.cwd !== session.cwd ||
            meta.gitBranch !== session.gitBranch ||
            JSON.stringify(meta.listeningPorts) !== JSON.stringify(session.listeningPorts);
          if (changed) {
            ptyManager.updateMetadata(session.id, meta);
            onChange(session.id, meta);
          }
        } catch {
          // process may have exited
        }
      }
    }, config.metadataIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async collect(pid: number, fallbackCwd: string): Promise<MetadataUpdate> {
    const [cwd, gitBranch, listeningPorts] = await Promise.all([
      this.getCwd(pid, fallbackCwd),
      this.getGitBranch(fallbackCwd),
      this.getListeningPorts(pid),
    ]);
    const actualGitBranch = await this.getGitBranch(cwd).catch(() => gitBranch);
    return { cwd, gitBranch: actualGitBranch, listeningPorts };
  }

  private async getCwd(pid: number, fallback: string): Promise<string> {
    try {
      // Linux: /proc/<pid>/cwd is a symlink to cwd
      const cwdLink = `/proc/${pid}/cwd`;
      return fs.realpathSync(cwdLink);
    } catch {
      return fallback;
    }
  }

  private async getGitBranch(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(
        `git -C ${JSON.stringify(cwd)} branch --show-current 2>/dev/null`,
        { timeout: 2000 }
      );
      const branch = stdout.trim();
      return branch || null;
    } catch {
      return null;
    }
  }

  private async getDescendantPids(pid: number): Promise<number[]> {
    const visited = new Set<number>();
    const all: number[] = [];
    const queue = [pid];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      if (visited.has(parent)) continue;
      visited.add(parent);
      all.push(parent);
      try {
        const { stdout } = await execAsync(
          `pgrep -P ${parent} 2>/dev/null`,
          { timeout: 1000 }
        );
        const children = stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !isNaN(n));
        queue.push(...children);
      } catch {
        // no children or process gone
      }
    }
    return all;
  }

  private async getListeningPorts(pid: number): Promise<number[]> {
    try {
      const pids = await this.getDescendantPids(pid);
      if (pids.length === 0) return [];

      if (process.platform === 'linux') {
        // Use ss to find listening TCP ports for our PIDs
        const pidFilter = pids.map((p) => `pid=${p}`).join('|');
        try {
          const { stdout } = await execAsync(
            `ss -tlnp 2>/dev/null | grep -E '(${pidFilter})'`,
            { timeout: 2000 }
          );
          const ports: number[] = [];
          const portRegex = /:(\d+)\s/g;
          let match: RegExpExecArray | null;
          for (const line of stdout.split('\n')) {
            // Match the local address column (e.g. 0.0.0.0:3000)
            const addrMatch = line.match(/\s+(\S+:\d+)\s+\S+:\*/);
            if (addrMatch) {
              const colonIdx = addrMatch[1].lastIndexOf(':');
              if (colonIdx >= 0) {
                const port = parseInt(addrMatch[1].substring(colonIdx + 1), 10);
                if (!isNaN(port)) ports.push(port);
              }
            }
          }
          portRegex.lastIndex = 0;
          return [...new Set(ports)].sort((a, b) => a - b);
        } catch {
          return [];
        }
      } else {
        // macOS: use lsof
        try {
          const { stdout } = await execAsync(
            `lsof -iTCP -sTCP:LISTEN -p ${pids.join(',')} -Fn 2>/dev/null`,
            { timeout: 2000 }
          );
          const ports = stdout
            .split('\n')
            .filter((l) => l.startsWith('n'))
            .map((l) => {
              const m = l.match(/:(\d+)$/);
              return m ? parseInt(m[1], 10) : NaN;
            })
            .filter((n) => !isNaN(n));
          return [...new Set(ports)].sort((a, b) => a - b);
        } catch {
          return [];
        }
      }
    } catch {
      return [];
    }
  }
}
