# madori MVP — 設計仕様書 v2

> **目的**: cmux の核心機能「複数エージェントの並行管理 + 注意喚起」をブラウザ上で再現する
> **方針**: cmux のコードは一切流用しない（AGPL-3.0）。独自設計・独自実装
> **対象読者**: コーディングエージェント（Claude Code 等）に渡して実装を任せる

全レビュー指摘の対応状況は末尾の「付録: レビュー指摘対応表」を参照。

-----

## 1. MVPスコープ

### 1.1 やること

|機能      |内容                                         |
|--------|-------------------------------------------|
|縦タブサイドバー|セッションの一覧・作成・切替・削除・リネーム                     |
|メタデータ表示 |各タブに cwd / git branch / listening ports を表示|
|通知リング   |OSC 9/99/777 検出 → タブ発光 + ペイン border アニメーション|
|通知パネル   |全セッションの通知を時系列で一覧表示。クリックでジャンプ               |
|セッションメモ |各セッションに紐づく Markdown textarea。右サイドパネルでトグル   |
|ターミナル   |xterm.js + WebGL で実 PTY に接続                |
|Docker  |docker-compose 一発で起動                       |

### 1.2 やらないこと（Phase 2 以降）

ペイン分割、Socket API (JSON-RPC)、SQLite 永続化、設定画面、アプリ内ブラウザ、CLI ツール

### 1.3 設計上の前提・制約

|項目               |方針                                                  |
|-----------------|----------------------------------------------------|
|マルチブラウザタブ        |最低限対応。session.created/session.deleted イベントで他タブに通知   |
|PTY WebSocket 切断時|PTY は生き残らせる。切断中の出力ロスは許容（シンプル優先）                     |
|PTY : WS の関係     |1 PTY : N WS（複数タブから同じセッションを開ける。全 WS に出力を送信）         |
|シェル指定            |REST API で shell パラメータは受け付けない。環境変数 `MADORI_SHELL` 固定|
|メモの永続化           |localStorage が source of truth。サーバーはインメモリ補助のみ       |
|Dead セッション再開     |新しいセッションID で PTY を作成し、古いタブを置き換える（メモだけ引き継ぎ）          |

-----

## 2. 技術スタック

```
フロントエンド
  React 19 + TypeScript
  @xterm/xterm v5 + addon-fit + addon-webgl + addon-web-links
  Zustand + zustand/middleware (persist) — localStorage 永続化
  Vite / Tailwind CSS v4

通信
  WebSocket (ws)
  PTY チャネル: バイナリフレーム（1セッション1接続）
  イベントチャネル: JSON（通知・メタデータ Push、全体で1接続）

バックエンド
  Node.js 22 LTS + TypeScript
  Express（HTTP + 静的配信）
  node-pty（encoding: null でバイナリモード）
  ws（WebSocket サーバー）
```

-----

## 3. アーキテクチャ

```
ブラウザ (React + xterm.js)
    ├── WebSocket /ws/pty/:sessionId  … PTY バイナリ I/O
    ├── WebSocket /ws/events          … 通知・メタデータ・セッション変更 Push
    └── HTTP      /api/sessions       … セッション CRUD
Node.js サーバー
    ├── PtyManager           … node-pty（バイナリモード）
    ├── NotificationDetector … PTY 出力 (Buffer) から OSC 検出
    ├── MetadataCollector     … cwd / git branch / ports（子プロセスツリー対応）
    └── EventBroadcaster     … /ws/events Push
```

### REST API

```
GET    /api/sessions                # 一覧（memo 含む）
POST   /api/sessions                # 作成 { name?, cwd? }  ※ shell パラメータなし
DELETE /api/sessions/:id            # 削除（PTY kill）
PATCH  /api/sessions/:id            # 更新 { name?, memo? }
GET    /api/notifications           # 全通知一覧（新しい順、上限100件）
```

レスポンス型:

```typescript
interface CreateSessionResponse {
  session: { id: string; name: string; cwd: string; memo: string; createdAt: number };
}
interface ListSessionsResponse {
  sessions: Array<{
    id: string; name: string; cwd: string; gitBranch: string | null;
    listeningPorts: number[]; notification: { title: string; body: string; timestamp: number } | null;
    hasUnread: boolean; memo: string; createdAt: number;
  }>;
}
```

cwd パラメータは `path.resolve()` + 存在確認でバリデーション。

-----

## 4. データモデル

```typescript
// ===== サーバー側（インメモリ Map） =====
interface Session {
  id: string; name: string; pid: number; shell: string;
  cols: number; rows: number; createdAt: number;
  cwd: string; gitBranch: string | null; listeningPorts: number[];
  notification: { title: string; body: string; timestamp: number } | null;
  hasUnread: boolean; memo: string;
}

// 通知履歴（インメモリ配列、上限100件）
interface NotificationEntry {
  id: string; sessionId: string; sessionName: string;
  title: string; body: string; timestamp: number; read: boolean;
}

// ===== クライアント側 Zustand =====
interface SessionState {
  sessions: Map<string, ClientSession>;
  activeSessionId: string | null;
  memoVisible: boolean;
  setActive: (id: string) => void;
  addSession: (session: ClientSession) => void;
  removeSession: (id: string) => void;
  updateMetadata: (id: string, meta: Partial<ClientSession>) => void;
  setNotification: (id: string, notif: { title: string; body: string; timestamp: number }) => void;
  updateMemo: (id: string, memo: string) => void;
  updateSessionStatus: (id: string, status: "alive" | "dead", exitCode?: number) => void;
  markRead: (id: string) => void;
  toggleMemo: () => void;
}

interface ClientSession {
  id: string; name: string; cwd: string; gitBranch: string | null;
  listeningPorts: number[];
  notification: { title: string; body: string; timestamp: number } | null;
  hasUnread: boolean; memo: string;
  status: "alive" | "dead"; exitCode: number | null;
  memoSynced: boolean;
}

interface NotificationState {
  notifications: NotificationEntry[];
  panelVisible: boolean;
  addNotification: (entry: NotificationEntry) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  togglePanel: () => void;
  unreadCount: () => number;
}
```

-----

## 5. WebSocket プロトコル

### 5.1 PTY チャネル (`/ws/pty/:sessionId`)

**全データはバイナリ。文字列変換は行わない。**

```
クライアント → サーバー:
  [0x00][...utf8 input bytes...]    キー入力
  [0x01][{"cols":N,"rows":N}]       リサイズ（JSON 部分のみ UTF-8）

サーバー → クライアント:
  [0x00][...raw pty output...]      PTY 出力（Buffer そのまま）
```

**重要:** node-pty は `encoding: null` で spawn。サーバーは Buffer にプレフィックス `0x00` を付けてそのまま送信。クライアントは `Uint8Array.subarray(1)` をそのまま `term.write()` に渡す。**TextEncoder/TextDecoder を PTY データパスに挟まない。**

### 5.2 イベントチャネル (`/ws/events`)

JSON。サーバー → クライアント一方向 Push:

```jsonc
{ "event": "notification", "sessionId": "xxx", "sessionName": "Session 1",
  "title": "Agent", "body": "Waiting for input", "timestamp": 1711700000000 }

{ "event": "metadata", "sessionId": "xxx", "cwd": "/home/user/project",
  "gitBranch": "feature-auth", "listeningPorts": [3000, 5173] }

{ "event": "session.exited", "sessionId": "xxx", "exitCode": 0 }

{ "event": "session.created",
  "session": { "id": "xxx", "name": "Session 1", "cwd": "/home/user", "memo": "", "createdAt": 1711700000000 } }

{ "event": "session.deleted", "sessionId": "xxx" }
```

-----

## 6. バックエンド詳細

### 6.1 ディレクトリ構成

```
server/src/
  index.ts / config.ts / PtyManager.ts / NotificationDetector.ts
  MetadataCollector.ts / EventBroadcaster.ts / routes.ts / wsHandlers.ts / utils.ts
```

### 6.2 node-pty 型定義の拡張

```typescript
// types/node-pty.d.ts
declare module "node-pty" {
  interface IPty {
    onData(callback: (data: Buffer) => void): IDisposable;
    write(data: Buffer | string): void;
  }
}
```

### 6.3 PtyConnectionManager

```typescript
class PtyConnectionManager {
  private connections = new Map<string, Set<WebSocket>>();

  add(sessionId: string, ws: WebSocket) { ... }
  remove(sessionId: string, ws: WebSocket) { ... }
  closeAll(sessionId: string) { ... }
  broadcast(sessionId: string, frame: Buffer) { ... }
}
```

### 6.4 PtyManager

- `encoding: null` で spawn
- sessionCounter でセッション名自動採番
- cwd は `path.resolve()` + `statSync` でバリデーション

### 6.5 NotificationDetector（Buffer ベース）

Buffer ベースで OSC を検出。while(true) ループで全マッチ処理。OSC 99 は `;` 区切り + 最初の `=` で分割。`clear(sessionId)` メソッドでバッファ除去。

### 6.6 MetadataCollector（子プロセスツリー対応）

- `getDescendantPids`: visited Set で循環参照防止
- ポーリング中の削除済みセッション参照をガード
- `getListeningPorts`: Linux は ss、macOS は lsof

### 6.7 サーバーエントリポイント（主要変更点）

- `setupPtyListeners` はセッション作成直後に1回のみ登録
- `NotificationHistory` クラス（上限100件、インメモリ）
- DELETE時: `closeAll` + `detector.clear` + `ptyManager.kill` + `broadcaster.send(session.deleted)`
- onExit時: `broadcaster.send(session.exited)` + `ptyConnections.closeAll` + `detector.clear` + `ptyManager.kill`

-----

## 7. フロントエンド詳細

### 7.1 ディレクトリ構成

```
client/src/
  main.tsx / App.tsx / types.ts / styles/globals.css
  components/  Sidebar / SidebarTab / TerminalView / NotificationRing
               NotificationPanel / MemoPanel / DeadSessionView
  stores/      sessionStore.ts / notificationStore.ts
  hooks/       useTerminalManager.ts / useEventSocket.ts / useKeyboardShortcuts.ts
  services/    api.ts
```

### 7.2 画面レイアウト

```
通常時:
┌──────────────┬──────────────────────────────────┐
│  サイドバー     │  ターミナル (xterm.js)             │
│  [Session 1]● │                                  │
│  [Session 2]  │                                  │
│  ──────────── │                                  │
│  [+ 新規]     │                                  │
│  [🔔 3]       │                                  │
└──────────────┴──────────────────────────────────┘
```

### 7.3 サイドバータブ

alive: `● name / branch • cwd / :ports / ⚡ 通知テキスト`
dead: `○ name [×] / セッション終了 / 📝 メモあり`

### 7.4 通知リング CSS（prefers-reduced-motion 対応）

```css
@keyframes notification-glow {
  0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
  70%  { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}
.terminal-container--notified {
  border: 2px solid var(--notification);
  animation: notification-glow 2s ease-out 3;
}
@media (prefers-reduced-motion: reduce) {
  .terminal-container--notified { animation: none; border: 3px solid var(--notification); }
}
```

### 7.5 MemoPanel

- localStorage 即保存（persist middleware）→ サーバー PATCH はデバウンス 1000ms（ベストエフォート）
- `memoSynced` フラグで初回アクティブ時のみ再送

### 7.6 useTerminalManager（インスタンスキャッシュ + リソース破棄）

- セッション切替で Terminal を破棄しない。キャッシュして DOM attach/detach で切り替え
- `reconnectAttempt` は `CachedTerminal` フィールド（クロージャ跨ぎ共有）
- WS `onopen` で `sendResize` を即実行
- WS close code 4004 で再接続停止
- dead セッションでは `dispose()` を呼ばない（スクロールバック保持）
- `dispose()` は UI レイヤーの責務

### 7.7 useEventSocket

- 指数バックオフ（1s〜30s、無限リトライ）
- `session.created` / `session.deleted` でマルチタブ対応
- `notification` の `sessionName` はサーバーから受け取る

### 7.8 キーボードショートカット

| ショートカット | アクション |
|---|---|
| `Ctrl+Shift+N` | 新規セッション作成 |
| `Alt+1` 〜 `Alt+9` | セッション切替 |
| `Ctrl+Shift+W` | セッション削除 |
| `Ctrl+Shift+U` | 未読ジャンプ |
| `Ctrl+Shift+I` | 通知パネル |
| `Ctrl+Shift+M` | メモパネル |

-----

## 8. Docker

```dockerfile
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git lsof procps iproute2 bash \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
ENV MADORI_HOST=0.0.0.0 MADORI_PORT=3000 SHELL=/bin/bash
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

-----

## 9. 設定（環境変数）

| 変数 | デフォルト | 説明 |
|---|---|---|
| `MADORI_HOST` | `127.0.0.1` | バインドアドレス |
| `MADORI_PORT` | `3000` | ポート |
| `MADORI_SHELL` | `$SHELL` → `bash` → `sh` | デフォルトシェル |
| `MADORI_METADATA_INTERVAL` | `3000` | メタデータポーリング間隔 (ms) |

-----

## 10. セキュリティ

- デフォルト `127.0.0.1` バインド
- **shell パラメータは API で受け付けない**
- **cwd は `path.resolve()` + 存在確認**
- 通知テキストは `textContent` でレンダリング

-----

## 11. レスポンシブ対応

ブレイクポイント: `>= 1024px` サイドバー常時 / `768-1023px` 折りたたみ / `< 768px` ドロワー

-----

## 12. ローカルストレージ復元

### 12.1 Zustand persist（Map シリアライズ）

```typescript
persist(storeConfig, {
  name: "madori:sessions",
  storage: {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.sessions && Array.isArray(parsed.state.sessions)) {
          parsed.state.sessions = new Map(parsed.state.sessions);
        } else {
          parsed.state = { ...parsed.state, sessions: new Map() };
        }
        return parsed;
      } catch { return null; }
    },
    setItem: (name, value) => {
      const serializable = {
        ...value,
        state: {
          ...value.state,
          sessions: value.state?.sessions instanceof Map
            ? Array.from(value.state.sessions.entries())
            : [],
        },
      };
      localStorage.setItem(name, JSON.stringify(serializable));
    },
    removeItem: (name) => localStorage.removeItem(name),
  },
  onRehydrateStorage: () => (state, error) => {
    if (!error && state) reconcileWithServer(state);
  },
});
```

### 12.2 復元フロー

```
localStorage 復元 → hydration 完了 → GET /api/sessions と突合:
  サーバーにある    → status: "alive"、WebSocket 再接続
  サーバーにない    → status: "dead"（タブは残す、メモ保持）
  LS にない新規    → addSession
```

### 12.3 Dead セッション

「新しいセッションを開始」: 新ID作成 → メモ引き継ぎ → 古いタブ除去 → 新タブ挿入

-----

## 13. アクセシビリティ（WCAG 2.2 Level AA）

```css
:root {
  --bg-primary: #1a1b26;
  --text-primary: #c0caf5;   /* 10.2:1 */
  --text-secondary: #9aa5ce; /* 6.8:1 */
  --text-muted: #737aa2;     /* 4.5:1 */
  --accent: #7aa2f7;         /* 5.9:1 */
  --notification: #3b82f6;   /* 4.8:1 */
}
```

ARIA: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-live="polite"`, `role="status"`, `role="dialog"`。`:focus-visible` アウトライン全要素。`prefers-reduced-motion` 対応。

-----

## 付録: レビュー指摘対応表（v1〜v6）

v6 N1: dead セッション WS 再接続ループ → onExit で `ptyManager.kill()` → Map除去 → 再接続時4004確定 → クライアントは4004で停止
v6 N2: memoSynced フラグで初回アクティブ時のみPATCH送信
v5 R1: reconnectAttempt を CachedTerminal フィールドに移動
v5 R2: NotificationDetector.clear() メソッドを明示
v5 R3: MetadataCollector ポーリング中の削除済みセッション参照ガード
v5 R4: Map シリアライズの完全な実装例
v5 R5: getDescendantPids に visited Set
v5 R6: ws.onopen で sendResize 即実行
v5 R7: dispose() は UI レイヤーの責務
v5 R8: dead 時は dispose しない
v5 R9: 通知 read はサーバー更新しない（LS優先）
v5 R10: bash を明示インストール + $SHELL→bash→sh フォールバック
