# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is an npm workspaces monorepo (Node.js >=20.6.0, ES modules) for **Inno Agent**, a personal learning agent built on the PI SDK.

- `apps/inno-agent/` — backend (CLI + HTTP server), TypeScript, compiles to `dist/`.
- `apps/inno-agent/web/` — frontend (React 19 + Lit + Tailwind 4 + Vite), workspace `inno-agent-web`.
- `electron/` — Electron main process (`main.js` + `loading.html`) for desktop builds.
- `runtime/` — local runtime state (config, data, skills); gitignored. Mapped to `INNO_*` env vars.
- `workspace/` — default agent working directory; gitignored.

PI SDK packages (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-web-ui`) are pulled from npm.

Key dependencies: `ws` (WebSocket), `node-pty` (PTY terminal), `cron-parser` (scheduler), `@larksuiteoapi/node-sdk` (Feishu), `typebox` (validation), `undici` (HTTP client), `pi-subagents` (optional subagent support), `pi-sandbox` (optional OS-level sandboxing).

`vitest` is a dev dependency but no test scripts or test files exist — the TypeScript build (`npm run build`) serves as the sanity check.

Backend TypeScript targets **ES2022** with **Node16** module resolution (see `apps/inno-agent/tsconfig.json`).

## Common Commands

All commands are run from the repo root and use `npm --workspace` under the hood.

```bash
# Build backend + web
npm run build

# Start HTTP server (serves API + web/dist on port 3000)
npm run server -- --home ./runtime --workspace ./workspace --port 3000

# Start CLI (terminal agent, no HTTP)
npm run start -- --home ./runtime --workspace ./workspace

# Dev: run server and Vite dev separately
npm run dev:server      # backend on :3000
npm run web:dev         # Vite on :5173, proxies /api -> :3000

# Sandbox mode (pi-sandbox enabled, isolates agent tool execution)
npm run sandbox -- --home ./runtime --workspace ./workspace
npm run server:sandbox -- --home ./runtime --workspace ./workspace --port 3000
```

### Dev restart rules

- Changes to `src/server.ts` or backend API → `npm run build` + restart server.
- Changes to `web/vite.config.ts` → restart Vite.
- Changes under `web/src/` → Vite HMR usually handles it.
- If upload/Wiki/proxy behavior misbehaves, fully restart both. Health checks: `curl localhost:3000/health`, `curl localhost:5173/api/wiki/pages`.

### restart-dev.sh

The `restart-dev.sh` script at the repo root orchestrates the full dev lifecycle: `build`, `start`, `stop`, `status`, `logs`, `smoke`. Supports `--mode dev|prod`, `--skip-build`, `--sandbox`/`--no-sandbox`. Run `bash restart-dev.sh --help` for details. Equivalent npm shortcut: `npm run restart:fast` (skips build).

### Electron desktop builds

```bash
npm run electron              # Run desktop app locally
npm run electron:build        # Package macOS DMG (arm64)
npm run electron:build:win    # Package Windows NSIS + MSI (x64)
```

`electron/main.js` spawns the Node server as a child process (`ELECTRON_RUN_AS_NODE=1`), shows a loading window while polling `/health`, then opens the main window. First launch creates a default config at `~/.inno-agent/config/config.json`.

### CI/CD

GitHub Actions workflows (`.github/workflows/`):
- `release-mac.yml` — macOS Electron DMG builds on ARM64, triggered by `v*.*.*` tags or workflow_dispatch.
- `release-win.yml` — Windows NSIS + MSI builds on x64, same trigger.

## Runtime Path Resolution

Both `cli.ts` and `server.ts` bootstrap through `apps/inno-agent/src/runtime.ts`. This is the single source of truth for where data lives.

Precedence: CLI flag → env var → `~/.inno-agent/...`.

| CLI flag | Env var | Default |
|---|---|---|
| `--home` | `INNO_HOME` | `~/.inno-agent` |
| `--config` | `INNO_CONFIG_FILE` | `<configDir>/config.json` |
| `--config-dir` | `INNO_CONFIG_DIR` | `<home>/config` |
| `--data` / `--data-dir` | `INNO_DATA_DIR` | `<home>/data` |
| `--skills` / `--skills-dir` | `INNO_SKILLS_DIR` | `<home>/skills` |
| `--workspace` / `--workspace-dir` | `INNO_WORKSPACE_DIR` | invocation CWD |
| `--port` | `INNO_PORT` (via config) | `3000` |

Derived paths inside `dataDir`: `learner/`, `sessions/`, `jobs/`, `l2/`, `l3/`, `channels/`. `applyRuntimeEnvironment` re-exports the resolved paths back into `process.env` plus `PI_CODING_AGENT_SESSION_DIR` so PI SDK code picks them up. It also sets `PI_CODING_AGENT_DIR` to `configDir` so pi-sandbox reads `sandbox.json` from the config directory.

When editing path-related code, change `runtime.ts` rather than hard-coding paths in `cli.ts`/`server.ts`.

## Architecture

### Agent core (PI SDK + Inno extension)

The agent loop is provided by `@earendil-works/pi-coding-agent` (npm). Inno wraps it with an extension factory in `apps/inno-agent/src/agent/inno-extension.ts`, which:

1. Registers model providers from `config.json` via `pi.registerProvider` (e.g. an InnoSpark Anthropic-compatible endpoint).
2. Registers six tool groups: **learner tools** (L1), **scheduler tools**, **L2 wiki tools**, **L3 recall tools**, **practice lab tools**, **document tools**.
3. Hooks `before_agent_start` to prepend `INNO_SYSTEM_PROMPT` + an L1 context pack (profile + recent events) + threshold-gated L3 recall to the system prompt for every turn.
4. Hooks `session_start` to install custom TUI header/title.
5. Persists `model_select` events back to `config.json`.

Key files in `apps/inno-agent/src/agent/`:
- `system-prompt.ts` — defines `INNO_SYSTEM_PROMPT`, the core educational instruction prompt injected every turn.
- `inno-extension.ts` — extension factory that wires everything together (tools, hooks, skills).
- `pi-runner.ts` — server-side facade around PI session APIs (`initSession`, `createNewSession`, `runPromptStreaming`, `completePromptOnce`, `switchModel`, etc.), shared by REST + SSE endpoints.
- `provider-sync.ts` — syncs providers from config into PI runtime and subagents.
- `question-bridge.ts` — bridges `ask_user_question` tool calls from agent to web UI via an EventEmitter.
- `practice-tools.ts` — Practice Lab tools (run commands, read run records).
- `document-tools.ts` — file uploads, workspace file reading, document preview (CSV, Office formats).

`cli.ts` calls PI's `main(...)` with this extension and forces `--no-skills --skill <skillsDir>` so only the project's skills directory is loaded.

`server.ts` (HTTP) goes through `agent/pi-runner.ts`.

### Storage layer (`src/storage/`)

`file-store.ts` is the general-purpose JSON file persistence layer. Used by multiple subsystems (learner profile, jobs, wiki manifest) as a thin typed wrapper over `readFileSync`/`writeFileSync` with atomic writes.

### Memory system

Three layers, all file-backed under `dataDir`:

- **L1 learner profile** (`src/memory/learner/`): evidence-driven profile + event log. `profile-store.ts` persists learner state; `profile-updater.ts`/`auto-profile.ts` mutate the profile from tool calls. Summarized into a `ContextPack` injected each turn. The learner can inspect and edit their profile directly.
- **L2 wiki memory** (`src/memory/l2/`): a structured wiki with `manifest-store.ts`, `raw-store.ts`, `wiki-maintainer.ts` (parses frontmatter), `wiki-linker.ts`, `wiki-query.ts`, plus a `summarizer.ts`, `source-converter.ts`, and `document-parser.ts` (handles PDF, Office documents, images). Exposed both to the agent (as tools) and to the web UI via `/api/wiki/*` (pages list, page CRUD, graph, stats).
- **L3 cross-conversation recall** (`src/memory/l3/`): indexes PI session JSONL files into SQLite (`node:sqlite`) with FTS5 full-text search for lexical retrieval. `sqlite-store.ts` manages the schema (chunks + embeddings tables). `indexer.ts` extracts messages from session files. `recall.ts` performs threshold-gated retrieval (`l3_recall` tool). Degrades gracefully on Node <22.5 (where `node:sqlite` is unavailable) — L3 recall is simply disabled.

### Scheduler

`src/scheduler/` implements cron-driven background jobs. `JobStore` persists `jobs.json` and appends `runs.jsonl` per execution. `CronScheduler` (uses `cron-parser`) triggers `job-runner.executeJob`. Jobs can also be invoked manually via `/api/jobs/:id/run` or from the agent itself via the `run_scheduled_job` tool. On boot, `normalizePersistedJobs` backfills `nextRunAt`/`lastStatus`/`runCount` fields, and `migrateReminderChannels` repoints legacy `push_reminder` jobs to the registered default Feishu target.

### Channels

`src/channels/` defines a `ChannelRegistry` and registers channels when their respective config blocks are present:

- **Feishu** (`feishu/feishu-channel.ts`): native Lark/Feishu integration via `@larksuiteoapi/node-sdk`.
- **QQ** and **WeChat** (`bridge/bridge-channel.ts`): bridge/sidecar mode — the agent communicates with an external sidecar process over HTTP, which handles the actual IM protocol. Each has a `sidecarBaseUrl` in config. Inbound messages arrive via `bridge/bridge-server.ts`, a local HTTP server that receives callbacks from sidecars.
- **WeChat iLink** (`wechat/ilink-client.ts`): alternative non-bridge WeChat mode using iLink protocol instead of a sidecar.
- `personal-dispatcher.ts` pushes reminders and messages back out through registered channels.
- `channel-tools.ts` exposes agent tools (`send_file_to_channel`, etc.) for interacting with channels.
- `dedupe-store.ts` prevents duplicate message delivery; `run-log.ts` tracks channel operation outcomes.

### HTTP server (`src/server.ts`)

Plain Node `http.createServer` (no framework). Key endpoints:
- `POST /api/chat/stream` — SSE streaming chat.
- `POST /api/chat` — non-streaming chat (full response).
- `GET/PUT /api/wiki/*` — wiki CRUD, graph, stats.
- `GET/POST/PATCH/DELETE /api/jobs[/:id]` — job management; `POST /api/jobs/:id/run` for manual execution.
- `GET /api/sessions` / `GET /api/sessions/:id` — session listing.
- `GET /api/skills` — list loaded skills.
- `POST /api/skills/upload` — accepts `<skill-name>.zip`, unpacks into `skillsDir/<name>/` via `spawnSync('unzip', ...)`.
- `PATCH /api/skills/:name` — enable/disable a skill.
- `DELETE /api/skills/:name` — remove a skill.
- `POST /api/skills/reload` — reload PI resources after skill changes.
- `GET /api/settings` — current config (redacted API keys).
- `GET /health` — health check (polled by Electron loading screen).
- WebSocket upgrade for `/api/terminal` — xterm.js in-browser terminal.

Static frontend is served from `paths.webDistDir = apps/inno-agent/web/dist` when present. Skills are loaded from `paths.skillsDir` (defaults to `<home>/skills` but can be pointed at `.inno/skills/` for project-local skills).

### Terminal / Practice Lab (`src/terminal/`)

In-browser terminal (xterm.js over WebSocket) scoped to a workspace. `terminal-session-manager.ts` manages PTY sessions via `node-pty` (`local-pty-backend.ts`). `run-record-store.ts` persists run records that the agent can read (via practice tools in `agent/practice-tools.ts`), enabling the agent to observe command outputs in the Practice Lab.

### Workspace management (`src/workspace/`)

`workspace-registry.ts` manages multiple workspace directories. Each workspace has a `WorkspaceMeta` record (id, name, path, temp flag) persisted in `workspaces.json`. Sessions are bound to workspaces. The default workspace is the invocation CWD. Temp workspaces are auto-created for one-off tasks and cleaned up later.

### Document tools (`agent/document-tools.ts`)

Handles file uploads, workspace file reading, and document preview (CSV, Office formats). Uses `@llamaindex/liteparse` for document parsing. Works alongside the L2 wiki's `document-parser.ts` for ingestion into the knowledge base.

### Subagents (`pi-subagents`)

Optional subagent support via `pi-subagents` package, configured with `subagents.enabled` in `config.json`. When enabled, the agent can spawn sub-agents for parallel or isolated tasks.

### Skills loading

Skills are loaded from `paths.skillsDir`, which defaults to `<home>/skills` but is pointed at `.inno/skills/` for development. Skills are Markdown files that declare agent capabilities, tool restrictions, and custom instructions. The PI SDK parses skill YAML frontmatter for metadata.

- `cli.ts` forces `--no-skills --skill <skillsDir>` — disables PI's built-in skills, loads only from the project's skills directory.
- `server.ts` loads skills from `paths.skillsDir` via `loadSkillsFromDir`.
- The web UI lists skills via `GET /api/skills` and allows upload of `<skill-name>.zip` files via `POST /api/skills/upload` (unzips into skills dir).
- Skills are re-indexed on server startup and after upload/reload.

### Sandbox (`pi-sandbox`)

Optional OS-level sandbox for agent bash/file operations, enabled with `--sandbox` flag (requires `ripgrep`). Configured via:

- **Global**: `<configDir>/sandbox.json` (typically `runtime/config/sandbox.json`)
- **Project-level** (higher priority): `<workspaceDir>/.pi/sandbox.json`

Configuration supports `network.allowedDomains` and `filesystem` policies (`allowRead`, `denyRead`, `allowWrite`, `denyWrite`) with glob patterns. Intercepted operations trigger interactive prompts (allow once/project/globally).

The `PI_CODING_AGENT_DIR` env var is set to `configDir` in `runtime.ts` so pi-sandbox can locate its config.

### Web UI

Hybrid React + Lit. Mounts in `web/src/main.tsx` → `react/App.tsx`. State lives in framework-agnostic `stores/` (small `EventEmitter`-based stores: `chat-store`, `sessions-store`, `wiki-store`, `jobs-store`, `skills-store`, `settings-store`, `workspace-store`, `workspaces-store`, `learner-store`, `notebook-store`, `terminal-store`, `graph-store`, `app-store`). Each store extends `EventEmitter` — components subscribe to change events and re-render on state mutation. REST/SSE calls go through `web/src/api/`. Some legacy Lit components remain under `components/`. Tailwind 4 via `@tailwindcss/vite`.

Key UI dependencies: `cytoscape` (wiki graph), `@xterm/xterm` (in-browser terminal), `@uiw/react-codemirror` (code editor), `@uiw/react-md-editor` (markdown editor), `motion` (animations).

**i18n**: The UI supports Chinese (`zh-CN`, default) and English (`en`), managed by `i18next` + `react-i18next` in `web/src/i18n/`. Locale is persisted to `localStorage` under `inno.locale`.

## Configuration

Runtime config lives at `<configDir>/config.json` (template: `config.example.json` at repo root). It declares `defaultProvider`, `defaultModel`, a `providers` map (each with `baseUrl`, `api` ∈ {`openai-completions`, `anthropic-messages`}, `apiKey`, `models[]`), optional `server.port`, optional `channels.feishu` / `channels.qq` / `channels.wechat` blocks, optional `bridge.token` (for bridge-mode channels), and optional `subagents.enabled`. The server hot-rewrites this file when the user switches model via the UI.

Model config supports `reasoning` (boolean), `contextWindow`, and `maxTokens` per model entry.

**Config manipulation** is centralized in `apps/inno-agent/src/config.ts` (`normalizeConfig`, `saveConfig`, `setDefaultModel`, `upsertProvider`, `deleteProvider`, `getConfiguredPort`). It handles legacy config migration (`openai` → `providers.openai-custom`) and normalizes missing fields with sensible defaults. All config writes should go through these helpers rather than directly writing the JSON file.

The backend package declares a `bin` entry (`"inno": "dist/cli.js"`), so after a global install the `inno` command is available.
