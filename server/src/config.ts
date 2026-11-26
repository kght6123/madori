import * as fs from 'fs';

function resolveShell(): string {
  const envShell = process.env.MADORI_SHELL || process.env.SHELL;
  for (const s of [envShell, '/bin/bash', '/bin/sh']) {
    if (s) {
      try { fs.accessSync(s, fs.constants.X_OK); return s; } catch {}
    }
  }
  return 'sh';
}

export const config = {
  host: process.env.MADORI_HOST ?? '127.0.0.1',
  port: Number(process.env.MADORI_PORT ?? 3000),
  shell: resolveShell(),
  metadataIntervalMs: Number(process.env.MADORI_METADATA_INTERVAL ?? 3000),
  maxNotifications: 100,
};
