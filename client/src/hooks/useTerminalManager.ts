import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { IDisposable } from '@xterm/xterm';

interface CachedTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  dataDisposable: IDisposable | null;
  reconnectAttempt: number;
}

class TerminalManager {
  private cache = new Map<string, CachedTerminal>();
  private activeSessionId: string | null = null;

  getOrCreate(sessionId: string): CachedTerminal {
    if (this.cache.has(sessionId)) return this.cache.get(sessionId)!;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Monaco', monospace",
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selectionBackground: '#364A82',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch {
      // fallback to canvas renderer
    }

    terminal.loadAddon(new WebLinksAddon());

    const container = document.createElement('div');
    container.style.cssText = 'width:100%;height:100%;';
    container.className = 'xterm-container';
    terminal.open(container);

    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch { /* ignore */ }
        const entry = this.cache.get(sessionId);
        if (entry?.ws?.readyState === WebSocket.OPEN) {
          this.sendResize(entry.ws, terminal.cols, terminal.rows);
        }
      });
    });
    resizeObserver.observe(container);

    const entry: CachedTerminal = {
      terminal,
      fitAddon,
      ws: null,
      container,
      resizeObserver,
      dataDisposable: null,
      reconnectAttempt: 0,
    };
    this.cache.set(sessionId, entry);
    this.connect(sessionId, entry);
    return entry;
  }

  attachTo(sessionId: string, parentElement: HTMLElement): void {
    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const prev = this.cache.get(this.activeSessionId);
      if (prev?.container.parentElement) prev.container.remove();
    }

    const entry = this.getOrCreate(sessionId);
    parentElement.appendChild(entry.container);
    this.activeSessionId = sessionId;
    requestAnimationFrame(() => {
      try { entry.fitAddon.fit(); } catch { /* ignore */ }
    });
  }

  detachFrom(sessionId: string): void {
    const entry = this.cache.get(sessionId);
    if (entry?.container.parentElement) {
      entry.container.remove();
    }
  }

  dispose(sessionId: string): void {
    const entry = this.cache.get(sessionId);
    if (!entry) return;

    entry.dataDisposable?.dispose();
    entry.resizeObserver.disconnect();
    entry.ws?.close();
    entry.terminal.dispose();
    entry.container.remove();
    this.cache.delete(sessionId);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  disposeAll(): void {
    for (const id of [...this.cache.keys()]) {
      this.dispose(id);
    }
  }

  private connect(sessionId: string, entry: CachedTerminal): void {
    const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof location !== 'undefined' ? location.host : 'localhost:3000';
    const ws = new WebSocket(`${proto}//${host}/ws/pty/${sessionId}`);
    ws.binaryType = 'arraybuffer';
    entry.ws = ws;

    ws.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const buf = new Uint8Array(e.data);
      if (buf[0] === 0x00) {
        entry.terminal.write(buf.subarray(1));
      }
    };

    entry.dataDisposable?.dispose();
    entry.dataDisposable = entry.terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        const encoded = new TextEncoder().encode(data);
        const frame = new Uint8Array(encoded.length + 1);
        frame[0] = 0x00;
        frame.set(encoded, 1);
        ws.send(frame);
      }
    });

    ws.onopen = () => {
      entry.reconnectAttempt = 0;
      this.sendResize(ws, entry.terminal.cols, entry.terminal.rows);
    };

    ws.onclose = (event: CloseEvent) => {
      entry.ws = null;
      if (!this.cache.has(sessionId)) return;
      // 4004 = Session not found — stop reconnecting
      if (event.code === 4004) return;
      const delay = Math.min(1000 * Math.pow(2, entry.reconnectAttempt), 30000);
      entry.reconnectAttempt++;
      setTimeout(() => {
        if (this.cache.has(sessionId)) this.connect(sessionId, entry);
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private sendResize(ws: WebSocket, cols: number, rows: number): void {
    const json = JSON.stringify({ cols, rows });
    const encoded = new TextEncoder().encode(json);
    const frame = new Uint8Array(encoded.length + 1);
    frame[0] = 0x01;
    frame.set(encoded, 1);
    ws.send(frame);
  }
}

// Singleton instance
const terminalManager = new TerminalManager();

export function useTerminalManager() {
  return terminalManager;
}

export function useTerminalAttach(
  sessionId: string | null,
  containerRef: React.RefObject<HTMLDivElement | null>
): void {
  const manager = useTerminalManager();

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;
    manager.attachTo(sessionId, containerRef.current);
    return () => {
      manager.detachFrom(sessionId);
    };
  }, [sessionId, manager, containerRef]);
}
