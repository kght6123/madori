// OSC detection using Buffer-based approach
// OSC format: ESC ] <code> ; <data> BEL  or  ESC ] <code> ; <data> ST
// ESC = 0x1b, ] = 0x5d, BEL = 0x07, ST = ESC \

export interface NotificationResult {
  title: string;
  body: string;
}

type NotificationCallback = (sessionId: string, result: NotificationResult) => void;

export class NotificationDetector {
  private buffers = new Map<string, Buffer>();
  private callback: NotificationCallback;

  constructor(callback: NotificationCallback) {
    this.callback = callback;
  }

  feed(sessionId: string, data: Buffer): void {
    let buf = this.buffers.get(sessionId);
    if (buf) {
      buf = Buffer.concat([buf, data]);
    } else {
      buf = Buffer.from(data);
    }

    // Process all complete OSC sequences
    while (true) {
      // Find ESC ]
      let oscStart = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === 0x1b && buf[i + 1] === 0x5d) {
          oscStart = i;
          break;
        }
      }

      if (oscStart === -1) {
        // No OSC start found; keep last byte in case it's an incomplete ESC
        if (buf.length > 0 && buf[buf.length - 1] === 0x1b) {
          buf = buf.subarray(buf.length - 1);
        } else {
          buf = Buffer.alloc(0);
        }
        break;
      }

      // Find terminator: BEL (0x07) or ST (ESC \  = 0x1b 0x5c)
      let termEnd = -1;
      let termStart = -1;
      for (let i = oscStart + 2; i < buf.length; i++) {
        if (buf[i] === 0x07) {
          termStart = i;
          termEnd = i + 1;
          break;
        }
        if (buf[i] === 0x1b && i + 1 < buf.length && buf[i + 1] === 0x5c) {
          termStart = i;
          termEnd = i + 2;
          break;
        }
      }

      if (termStart === -1) {
        // Incomplete sequence — keep from oscStart
        buf = buf.subarray(oscStart);
        break;
      }

      // Extract payload: between ESC ] and terminator
      const payload = buf.subarray(oscStart + 2, termStart).toString('utf8');
      // Consume up to termEnd
      buf = buf.subarray(termEnd);

      this.parseOsc(sessionId, payload);
    }

    if (buf.length > 0) {
      this.buffers.set(sessionId, buf);
    } else {
      this.buffers.delete(sessionId);
    }
  }

  private parseOsc(sessionId: string, payload: string): void {
    // OSC 9 ; <message>
    // OSC 99 ; <title> = <body>   (or  ; title ; body)
    // OSC 777 ; notify ; <title> ; <body>

    const semiIdx = payload.indexOf(';');
    if (semiIdx === -1) return;

    const code = payload.substring(0, semiIdx);
    const rest = payload.substring(semiIdx + 1);

    if (code === '9') {
      // Simple notification: the rest is the message body
      this.callback(sessionId, { title: 'Notification', body: rest });
    } else if (code === '99') {
      // title=body  or  title;body
      const eqIdx = rest.indexOf('=');
      const scIdx = rest.indexOf(';');
      if (eqIdx !== -1 && (scIdx === -1 || eqIdx < scIdx)) {
        const title = rest.substring(0, eqIdx);
        const body = rest.substring(eqIdx + 1);
        this.callback(sessionId, { title: title || 'Notification', body });
      } else if (scIdx !== -1) {
        const title = rest.substring(0, scIdx);
        const body = rest.substring(scIdx + 1);
        this.callback(sessionId, { title: title || 'Notification', body });
      } else {
        this.callback(sessionId, { title: 'Notification', body: rest });
      }
    } else if (code === '777') {
      // notify;title;body
      const parts = rest.split(';');
      if (parts[0] === 'notify' && parts.length >= 3) {
        this.callback(sessionId, { title: parts[1], body: parts[2] });
      } else if (parts[0] === 'notify' && parts.length === 2) {
        this.callback(sessionId, { title: parts[1], body: '' });
      }
    }
  }

  clear(sessionId: string): void {
    this.buffers.delete(sessionId);
  }
}
