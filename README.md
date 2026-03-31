# madori

ブラウザベースのターミナルマルチプレクサ。複数の PTY セッションを縦タブで管理し、OSC 通知を検出してリアルタイムに通知します。

## 機能

- 縦タブサイドバー（作成・切替・削除・リネーム）
- xterm.js + WebGL ターミナル（スクロールバック保持）
- OSC 9/99/777 通知検出 → タブ発光 + 通知パネル
- セッションメモ（localStorage 永続化）
- メタデータ表示（cwd / git branch / listening ports）
- マルチブラウザタブ対応

## セットアップ

### ローカル開発

```bash
# 依存インストール
npm install

# サーバー + クライアント同時起動
npm run dev

# サーバー: http://localhost:3000
# クライアント: http://localhost:5173
```

### Docker

```bash
docker compose up -d
# http://localhost:3000 にアクセス
```

## テスト

```bash
# ユニットテスト（server + client）
npm test

# E2E テスト（Playwright）
# 事前にサーバーとクライアントを起動しておく必要があります
cd client && npm run test:e2e
```

## 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `MADORI_HOST` | `127.0.0.1` | バインドアドレス |
| `MADORI_PORT` | `3000` | ポート番号 |
| `MADORI_SHELL` | `$SHELL` → `bash` → `sh` | 使用シェル |
| `MADORI_METADATA_INTERVAL` | `3000` | メタデータポーリング間隔 (ms) |

## キーボードショートカット

| ショートカット | 操作 |
|---|---|
| `Ctrl+Shift+N` | 新規セッション作成 |
| `Alt+1` 〜 `Alt+9` | セッション切替 |
| `Ctrl+Shift+W` | アクティブセッション削除 |
| `Ctrl+Shift+M` | メモパネル開閉 |
| `Ctrl+Shift+I` | 通知パネル開閉 |
| `Ctrl+Shift+U` | 未読セッションにジャンプ |

## 通知テスト

ターミナルで以下を実行すると通知が発火します:

```bash
# OSC 9
printf '\e]9;Hello from terminal\a'

# OSC 99
printf '\e]99;t=Title;b=Body message\a'

# OSC 777
printf '\e]777;notify;Alert;Something happened\a'
```

## アーキテクチャ

```
ブラウザ (React + xterm.js)
    ├── WebSocket /ws/pty/:sessionId  … PTY バイナリ I/O
    ├── WebSocket /ws/events          … 通知・メタデータ Push
    └── HTTP      /api/sessions       … セッション CRUD

Node.js サーバー
    ├── PtyManager           … node-pty (encoding: null)
    ├── NotificationDetector … OSC 9/99/777 Buffer 検出
    ├── MetadataCollector    … cwd/git/ports ポーリング
    └── EventBroadcaster     … /ws/events Push
```
