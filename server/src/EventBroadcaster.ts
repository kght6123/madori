import WebSocket from 'ws';

export class EventBroadcaster {
  private clients = new Set<WebSocket>();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  send(data: object): void {
    const json = JSON.stringify(data);
    for (const ws of this.clients) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(json);
        }
      } catch {
        // ignore individual errors
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
