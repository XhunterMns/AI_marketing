# AI Autonomous Marketing Platform

An end-to-end, AI-powered marketing platform: a **Node.js/Express backend** that talks to a local AI gateway (OpenClaw + Ollama) to generate marketing campaigns and competitor analyses, then schedules delivery to **Telegram** (and supports **Facebook/Meta** posts). The whole thing is fronted by a **modern Angular 17 SPA** with a dashboard, campaign generator, competitor analysis tool, history, and analytics views. Everything is containerized with **Docker Compose**.

If you read this document top to bottom you should understand what every file does, how a request flows from the browser to Telegram, and how to run, extend, and debug the system.

---

## Table of contents

1. [What the project does](#1-what-the-project-does)
2. [High-level architecture](#2-high-level-architecture)
3. [Tech stack](#3-tech-stack)
4. [Repository layout](#4-repository-layout)
5. [Services at a glance (docker-compose)](#5-services-at-a-glance-docker-compose)
6. [Environment variables](#6-environment-variables)
7. [The AI layer — OpenClaw + Ollama](#7-the-ai-layer--openclaw--ollama)
8. [Backend walkthrough](#8-backend-walkthrough)
9. [Queue & worker — BullMQ + Redis](#9-queue--worker--bullmq--redis)
10. [Persistence — MongoDB & Mongoose](#10-persistence--mongodb--mongoose)
11. [Delivery — Telegram & Meta Graph](#11-delivery--telegram--meta-graph)
12. [Frontend walkthrough (Angular 17)](#12-frontend-walkthrough-angular-17)
13. [End-to-end request flows](#13-end-to-end-request-flows)
14. [Running locally (without Docker)](#14-running-locally-without-docker)
15. [Running with Docker Compose](#15-running-with-docker-compose)
16. [Adding a new feature end-to-end (worked example)](#16-adding-a-new-feature-end-to-end-worked-example)
17. [API reference](#17-api-reference)
18. [Known issues & housekeeping](#18-known-issues--housekeeping)
19. [Glossary](#19-glossary)

---

## 1. What the project does

The platform lets a marketer (or developer) do four things from a single UI:

1. **Generate a multi-day marketing campaign** from a natural-language prompt. The AI returns a JSON campaign (title, social posts, content calendar, KPIs, hashtags, etc.), and the system can optionally deliver the posts to a Telegram channel on a schedule.
2. **Analyze a competitor** by company name and/or website. The AI returns a SWOT, trend list, and recommendations.
3. **Send posts to Telegram** on demand (single-shot, no scheduling) — useful for ad-hoc messages.
4. **Post to a Facebook Page** via the Meta Graph API (with an optional OpenClaw "plan" preflight).

Behind the scenes there are two long-lived processes: a **backend** (Express HTTP API) and a **worker** (BullMQ consumer that sends the scheduled Telegram messages). Redis is the queue backend and MongoDB is the persistent store for campaign documents.

---

## 2. High-level architecture

```
┌────────────────────────────────────┐      HTTP       ┌─────────────────────────────────────┐
│  Angular 17 SPA (browser)          │ ──────────────▶ │  Express Backend (Node.js)          │
│  ai-marketing-frontend/            │                 │  index.js   (port 3000)             │
│                                    │ ◀────────────── │                                     │
│  Dashboard / Campaign /            │   JSON          │  Controllers:                       │
│  Competitors / History / ...       │                 │   /generate, /generate-campaign,    │
│                                    │                 │   /competitor-analysis,             │
│                                    │                 │   /telegram/send, /meta/post,       │
│                                    │                 │   /activate-campaign, /cancel       │
└────────────────────────────────────┘                 └────────┬───────────────┬────────────┘
                                                                   │               │
                                              ┌────────────────────┘               └────────────────────┐
                                              ▼                                                          ▼
                                       ┌────────────────────┐                                  ┌─────────────────────┐
                                       │  AI Layer          │                                  │  Persistence         │
                                       │  OpenClaw :18789   │                                  │  MongoDB (Mongoose)  │
                                       │  (local gateway)   │                                  │  Campaign model      │
                                       │       │            │                                  │                     │
                                       │       ▼            │                                  │  Redis + BullMQ     │
                                       │  Ollama (local)    │                                  │  campaignQueue      │
                                       │  llama3 / etc.     │                                  │                     │
                                       └────────────────────┘                                  └─────────────────────┘
                                                                                                                                  │
                                                                                                                       ┌──────────▼──────────┐
                                                                                                                       │  Worker              │
                                                                                                                       │  worker.js           │
                                                                                                                       │  BullMQ consumer     │
                                                                                                                       │  (sends to Telegram) │
                                                                                                                       └──────────┬──────────┘
                                                                                                                                  │
                                                                                                                       ┌──────────▼──────────┐
                                                                                                                       │  Delivery            │
                                                                                                                       │  Telegram Bot API    │
                                                                                                                       │  Meta Graph API      │
                                                                                                                       └──────────────────────┘
```

When running in Docker Compose there are **four containers** (`backend`, `worker`, `redis`, `mongo`) plus the Angular app served by a fifth container (`frontend` via nginx). OpenClaw and Ollama run on the **host** (not in containers) because they need GPU access and direct access to local model files.

---

## 3. Tech stack

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Frontend           | Angular 17 (standalone components), Tailwind CSS, Angular CDK    |
| Frontend routing   | Angular Router with lazy-loaded route components                |
| HTTP client        | Angular `HttpClient` + functional HTTP interceptors              |
| Backend            | Node.js 22, Express 4, CORS, dotenv                             |
| AI gateway         | OpenClaw (local, port 18789, OpenAI-compatible)                  |
| Local LLM          | Ollama (any model, e.g. `llama3`, `minimax-m3:cloud`)            |
| Queue              | BullMQ 5 on Redis 7                                              |
| Database           | MongoDB 7 with Mongoose 9 (Campaign schema)                      |
| Delivery (chat)    | Telegram Bot API (`sendMessage`)                                 |
| Delivery (social)  | Meta Graph API v25.0 (`/{pageId}/feed`)                          |
| Containerization   | Docker, Docker Compose                                           |
| Reverse proxy      | nginx (serves the SPA + reverse-proxies API calls)               |

---

## 4. Repository layout

```
ai-marketing-backend/                              ← Backend root
├── index.js                                       ← Express entry point (USED by Docker)
├── server.js                                      ← Legacy duplicate (NOT used; see §18)
├── server.ts                                      ← Angular SSR leftover (NOT used)
├── queue.js                                       ← BullMQ queue setup (used by backend + worker)
├── worker.js                                      ← BullMQ worker: sends Telegram messages
├── openclaw/openclaw.json                         ← Local OpenClaw gateway config
├── .env.example                                   ← Template of required environment variables
├── Dockerfile                                     ← Container image for the backend
├── Dockerfile.worker                              ← Container image for the worker
├── docker-compose.yml                             ← Orchestrates backend + worker + redis + mongo + frontend
│
├── src/
│   ├── api/
│   │   ├── routes/routes.js                       ← Mounts all controllers under /api and at /
│   │   ├── controllers/
│   │   │   ├── generate.controller.js             ← POST /generate         (simple text gen)
│   │   │   ├── campaign.controller.js             ← POST /generate-campaign (multi-day scheduler)
│   │   │   ├── analysis.controller.js             ← POST /competitor-analysis
│   │   │   ├── meta.js                            ← POST /meta/post        (Facebook Graph)
│   │   │   └── posting.controller.js              ← POST /telegram/send    (manual send)
│   │   └── models/
│   │       ├── campaign.model.js                  ← Mongoose Campaign schema (factory fn)
│   │       └── analysis.model.js                  ← (currently empty / unused)
│   ├── config/config.js                           ← Centralized env config
│   ├── database/db.config.js                      ← Mongoose connection helper
│   └── utils/
│       ├── openclaw.utils.js                      ← HTTP client to OpenClaw gateway
│       ├── posting.utils.js                       ← Telegram sendMessage helper
│       ├── campaign.utils.js                      ← splitCampaignByDays + JSON helpers
│       └── analysis.utils.js                      ← (currently empty / unused)
│
└── ai-marketing-frontend/                         ← Angular 17 app (separate workspace)
    ├── src/app/
    │   ├── app.routes.ts                          ← Lazy-loaded routes (dashboard, campaign, ...)
    │   ├── app.component.*                        ← Root component (just <router-outlet /> inside shell)
    │   ├── core/
    │   │   ├── interceptors/error.interceptor.ts  ← Shows a toast on HTTP errors
    │   │   ├── models/index.ts                    ← Shared TypeScript interfaces
    │   │   ├── services/
    │   │   │   ├── api.service.ts                 ← Strongly-typed HTTP services (CampaignService, CompetitorAnalysisService)
    │   │   │   ├── dashboard.service.ts           ← In-memory stats + history for the dashboard
    │   │   │   ├── notification.service.ts        ← Toast notifications
    │   │   │   └── theme.service.ts               ← Light/dark theme toggle
    │   │   └── validators/telegram.validator.ts   ← Cross-field validator (Telegram fields required if enabled)
    │   ├── layout/
    │   │   ├── shell/                             ← App shell: sidebar + top nav + <router-outlet />
    │   │   ├── sidebar/                           ← Collapsible navigation
    │   │   └── top-nav/                           ← Top bar
    │   ├── features/                              ← Lazy-loaded feature pages
    │   │   ├── dashboard/                         ← Stats cards + recent activity
    │   │   ├── campaign-generator/                ← Big form + AI thinking loader + result sections
    │   │   ├── competitor-analysis/               ← Form + result cards (SWOT, trends, etc.)
    │   │   ├── history/                           ← List of past generations (in-memory)
    │   │   ├── analytics/                         ← Placeholder page
    │   │   └── settings/                          ← Placeholder page
    │   ├── shared/components/
    │   │   ├── ai-thinking-loader/                ← Animated loader shown while waiting for AI
    │   │   ├── empty-state/                       ← "Nothing yet" placeholder card
    │   │   ├── result-section-card/               ← Styled section card for AI results
    │   │   └── stat-card/                         ← Dashboard stat tile
    │   ├── generate-content/                      ← Legacy "Generate Campaign" page (older UI)
    │   ├── competitor-analysis/                   ← Legacy "Competitors" page (older UI)
    │   └── services/                              ← Older service files (kept for the legacy pages)
    ├── proxy.conf.json                            ← Dev-server proxy → http://localhost:3000
    ├── nginx.conf                                 ← Production nginx config (proxies /api/* → backend)
    ├── Dockerfile                                 ← Multi-stage build → nginx:alpine image
    └── tailwind.config.js / tailwind.css          ← Tailwind setup (PostCSS pipeline)
```

> The "legacy" pages (`generate-content/`, `competitor-analysis/`) are still wired into the router but are being replaced by the `features/` versions. Both sets of services still exist; the newer ones in `core/services/api.service.ts` are typed and recommended.

---

## 5. Services at a glance (docker-compose)

`docker-compose.yml` declares **five services**:

| Service   | Image / build                | Port (host) | Role                                                              |
| --------- | ---------------------------- | ----------- | ----------------------------------------------------------------- |
| frontend  | built from `ai-marketing-frontend/Dockerfile` | `80`        | Serves the Angular SPA + reverse-proxies API to the backend       |
| backend   | built from `Dockerfile`      | `3000`      | Express HTTP API (`node index.js`)                                |
| worker    | built from `Dockerfile.worker` | *(none)*   | BullMQ consumer that sends Telegram messages (`node worker.js`)   |
| redis     | `redis:7-alpine`             | `6379`      | Queue backend for BullMQ                                          |
| mongo     | `mongo:7`                    | `27017`     | Persistent storage for `Campaign` documents                        |

Two services run on the host (not in Compose):

- **OpenClaw** at `http://127.0.0.1:18789` — the AI gateway. `backend` reaches it via `http://host.docker.internal:18789` (set in the `OPENCLAW_GATEWAY_URL` env var; the `extra_hosts` directive maps `host.docker.internal`).
- **Ollama** — runs locally; OpenClaw talks to it.

---

## 6. Environment variables

The backend reads its config from environment variables (loaded via `dotenv` from `.env`). See `.env.example` for the canonical template.

| Variable                  | Required | Default                  | Purpose                                                                                |
| ------------------------- | -------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `PORT`                    |          | `3000`                   | Express port.                                                                          |
| `DATABASE_URL`            |          | *(empty)*                | Mongo connection string, e.g. `mongodb://mongo:27017/ai_marketing`. If empty, Mongo is not connected. |
| `REDIS_HOST`              |          | `127.0.0.1`              | Redis host. In Docker Compose this is set to `redis`.                                  |
| `REDIS_PORT`              |          | `6379`                   | Redis port.                                                                            |
| `OPENCLAW_GATEWAY_URL`    |          | `http://127.0.0.1:18789` | URL of the OpenClaw gateway. The backend appends `/v1/chat/completions`.                |
| `OPENCLAW_GATEWAY_TOKEN`  |          | *(empty)*                | Bearer token for OpenClaw. Sent as `Authorization: Bearer <token>` if set.              |
| `OPENCLAW_MODEL`          |          | `openclaw`               | Model name passed to the gateway.                                                      |
| `TELEGRAM_BOT_TOKEN`      | ✅ for Telegram delivery | *(empty)*     | Bot token from @BotFather. Required by `worker.js` and the `telegram/send` endpoint.   |
| `TELEGRAM_CHAT_ID`        | ✅ for Telegram delivery | *(empty)*     | Numeric chat ID (e.g. `-100…` for groups/channels).                                    |
| `TELEGRAM_GROUP_ID`       |          | *(empty)*                | Optional alias for the same value.                                                     |
| `TELEGRAM_CHANNEL_ID`     |          | *(empty)*                | Optional alias for the same value.                                                     |
| `META_GRAPH_VERSION`      |          | `v25.0`                  | Meta Graph API version used by `POST /meta/post`.                                      |

> **Security note**: never commit real tokens. The repo's `.env` currently contains live values; move them to `.env.local` or Docker secrets before publishing.

---

## 7. The AI layer — OpenClaw + Ollama

This is the part that confuses newcomers, so here's the full picture.

### What is OpenClaw?

OpenClaw is a **local AI gateway** — think of it as a self-hosted, OpenAI-compatible "OpenRouter." It runs as a small HTTP server on your machine and exposes an **OpenAI-compatible** chat completions endpoint:

- Gateway port: `18789` (configurable in `openclaw/openclaw.json`)
- Endpoint path used by the backend: `/v1/chat/completions`
- Auth: token-based (`Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>`)
- Optional: "skills" (e.g. `meta-graph-ai`) that the model can be told to use

The backend does **not** call Ollama directly. It calls OpenClaw, and OpenClaw forwards to whichever model backend is configured (Ollama in your setup).

### Why go through OpenClaw?

1. **Single config point.** Switch from Ollama to OpenAI to Anthropic by changing `OPENCLAW_GATEWAY_URL` / `OPENCLAW_MODEL` — no code changes.
2. **Auth + observability.** Token auth, request logging, retries are centralized in one place.
3. **Tool/agent layer.** OpenClaw can wrap models with "skills" (e.g. the `meta-graph-ai` skill is referenced in `src/api/controllers/meta.js`).

### Request chain

```
Angular UI
  → POST /generate-campaign                (Express)
  → callOpenClaw(prompt)                  (axios POST to :18789/v1/chat/completions)
  → OpenClaw gateway                      (token auth, optional skills, logs)
  → Ollama (or another configured backend)
  → model generates text
  → response bubbles back up
```

### Relevant files

- `openclaw/openclaw.json` — gateway config (port, bind, auth, allowed origins, etc.).
- `src/config/config.js` — reads `OPENCLAW_GATEWAY_URL` / `_TOKEN` / `_MODEL`.
- `src/utils/openclaw.utils.js` — the `callOpenClaw(prompt)` HTTP client. Has a 120-second axios timeout, wraps the response in a clean shape (`{ result }`), and normalizes errors into `{ status, details }` so controllers can pass them straight back to the client.

---

## 8. Backend walkthrough

### 8.1 Entry points

There are **three** Node files at the repo root, but only one is actually used.

| File       | Status         | What it is                                                                                        |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `index.js` | ✅ **Active**  | The real Express entry point. `Dockerfile` runs `node index.js`.                                  |
| `server.js` | ⚠️ Legacy    | A near-duplicate of `index.js` with hardcoded handlers (`/generate-campaign`, `/activate-campaign`, `/cancel-campaign`). Not used by Docker; would crash because it imports a model that doesn't exist. Safe to delete — see §18. |
| `server.ts` | ❌ Unused     | An Angular SSR server left over from the Angular CLI generator. Safe to delete.                   |

`index.js` does five things, in order:

1. Loads `express`, `cors`, the config module, and the database helper.
2. Mounts `cors()` and `express.json()`.
3. If `DATABASE_URL` is set, connects Mongoose in the background.
4. Registers all routes via `require("./src/api/routes/routes")(app)`.
5. Adds a 404 fallback and starts listening on `config.PORT`.

### 8.2 Routing — `src/api/routes/routes.js`

The router module exports a function that takes the Express `app` and wires every controller. Routes are mounted **twice**: once under `/api/...` and once at the root. The duplication is intentional — it lets the frontend hit either `http://localhost:3000/generate-campaign` or `http://localhost:3000/api/generate-campaign` depending on the environment.

The five exposed endpoints are:

| Method | Path                              | Controller                |
| ------ | --------------------------------- | ------------------------- |
| POST   | `/generate`                       | `generateController`      |
| POST   | `/generate-campaign`              | `campaignController`      |
| POST   | `/competitor-analysis`            | `analysisController`      |
| POST   | `/meta/post`                      | `metaController`          |
| POST   | `/telegram/send`                  | `postingController`       |

> The legacy `server.js` also exposes `/activate-campaign` and `/cancel-campaign` (for the "two-phase" generate-then-activate flow). Those routes are not currently registered in the router, so they only work if you run the legacy file. See §18 for a recommendation.

### 8.3 Controllers

All controllers follow the same pattern: validate input, delegate to a util / AI / queue, return JSON.

#### `generate.controller.js` — `POST /generate`
- Body: `{ prompt: string }`
- Calls `callOpenClaw(prompt)`.
- Returns `{ result: <text> }`.

#### `campaign.controller.js` — `POST /generate-campaign`
- Body: `{ prompt: string }`
- Builds a prompt asking the model to return plain text with explicit `Day 1:`, `Day 2:`, … markers.
- Calls `callOpenClaw(aiPrompt)` → returns the campaign text.
- Splits the text via `splitCampaignByDays(text)` (regex on `Day N:` markers) into `[{ day, message }, ...]`.
- For each day, enqueues a job in `campaignQueue` with payload `{ day, message }` and `delay: i * 10000` ms.
- Returns `{ success, message, totalDays, response, jobs }`. The `response` field is the raw AI text — the UI renders this.

> **Note**: the `delay: i * 10000` is a test speed (10 seconds per day). For real campaigns, change this to `step.day * 24 * 60 * 60 * 1000` (one real day per step).

#### `analysis.controller.js` — `POST /competitor-analysis`
- Body: `{ prompt, companyName?, websiteUrl? }`
- Builds a prompt asking for strict JSON with `summary`, `companyOverview`, `seoSummary`, `marketingStrategy`, `socialPresence`, `strengths`, `weaknesses`, `swot`, `competitors`, `trends`, `recommendations`, `aiOpportunities`.
- Strips code fences, attempts to parse JSON; falls back to `{ summary: <text>, raw: <text> }` if parsing fails.
- Returns `{ result }`.

#### `meta.js` — `POST /meta/post`
- Body: `{ message, pageId, accessToken, useOpenClaw=true }`
- If `useOpenClaw` is true, first calls OpenClaw to draft a "Meta Graph plan" (advisory only — currently does not modify the request).
- POSTs to `https://graph.facebook.com/{META_GRAPH_VERSION}/{pageId}/feed?message=…&access_token=…`.
- Returns Facebook's normalized response (`{ id, postId, raw }`).
- **Note**: a real Facebook page post requires a Page Access Token issued after **Business Verification**; the comment in `routes.js` flags this.

#### `posting.controller.js` — `POST /telegram/send`
- Body: `{ message, botToken, channelId }`
- Validates that all three are present, then calls `sendToTelegram(message, botToken, channelId)`.
- Returns `{ success: true }` on success, or `{ success: false, error, details }` on failure.

### 8.4 Utilities

#### `src/utils/openclaw.utils.js` — `callOpenClaw(prompt)`
- Reads `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MODEL` from `src/config/config.js`.
- Resolves the URL: if it doesn't end with `/v1/chat/completions`, appends it.
- POSTs `{ model, messages: [{ role: "user", content: prompt }], stream: false }`.
- 120-second axios timeout (slow-model safeguard).
- Extracts the assistant text from `data.choices[0].message.content` (with fallbacks to `text` and `choices[0].text`).
- Wraps errors into a clean `Error("OpenClaw gateway error")` with `.status` and `.details` so controllers can pass them straight back to the client.

#### `src/utils/posting.utils.js` — `sendToTelegram(message, botToken?, chatId?)`
- Falls back to env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` / `GROUP_ID` / `CHANNEL_ID`) if not provided.
- POSTs to `https://api.telegram.org/bot<token>/sendMessage` with 15s timeout.
- Wraps axios errors into an `Error` that carries `.status` and `.response`, so the worker can detect 429 / 5xx and retry.

#### `src/utils/campaign.utils.js`
- `splitCampaignByDays(text)` — regex `/Day\s+(\d+):([\s\S]*?)(?=Day\s+\d+:|$)/g` to split the AI's plain-text campaign into `[{ day, message }, ...]`.
- `toPlainTextCampaign` / `campaignJsonToText` — strip code fences and try to parse the response as JSON, falling back to plain text. Available if you switch the campaign controller to JSON mode.

#### `src/utils/analysis.utils.js`
- Empty. Nothing imports it. Safe to delete.

---

## 9. Queue & worker — BullMQ + Redis

### Why a queue at all?

1. **Scheduling.** Generating a 3-day campaign finishes in <1s, but the actual sends may be hours/days apart. BullMQ handles delayed jobs natively.
2. **Retries.** If Telegram returns 429 or 5xx, jobs should wait and retry automatically — exactly BullMQ's job.
3. **Visibility.** Failed jobs are kept around with their stack traces for debugging.

### `queue.js`

```js
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  maxRetriesPerRequest: null,
});

const campaignQueue = new Queue("campaignQueue", {
  connection,
  defaultJobOptions: {
    attempts: 5,                                    // retry up to 5 times
    backoff: { type: "exponential", delay: 5000 },   // 5s, 10s, 20s, 40s, 80s
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

module.exports = campaignQueue;
```

- Queue name: **`campaignQueue`**.
- Default job options apply to any job added with `campaignQueue.add(...)`.
- `removeOnComplete` keeps Redis from growing unboundedly (1 day, or last 1000 jobs).
- `removeOnFail` keeps failed jobs for 7 days for inspection.

### `worker.js`

A long-running process that subscribes to `campaignQueue`. For each job it:

1. Validates the payload (`message` must be a non-empty string).
2. Builds the text: `🚀 Day N\n\n<message>`.
3. Tries the Telegram API up to **3 times in-process** with 2s / 5s backoff for retriable errors (`429`, `5xx`, or no status).
4. Logs every failure with `status` and the Telegram `description` field so you can always see *why* a send failed.
5. Re-throws on final failure so BullMQ records the job as failed and applies its own queue-level backoff (5 attempts, exponential).
6. Runs at `concurrency: 1` to stay under Telegram's per-second flood limits.
7. Listens for `completed` / `failed` worker events for logging.

### End-to-end queue flow

```
campaign.controller.js
  ↓  for each day: campaignQueue.add("campaign-step", { day, message }, { delay: i*10000 })
Redis (campaignQueue)
  ↓  when the delay elapses
worker.js
  ↓  job handler runs sendToTelegram(...)
Telegram Bot API
```

---

## 10. Persistence — MongoDB & Mongoose

### What is stored

A `Campaign` document with this shape:

```js
{
  name: String,                   // AI-generated campaign name
  prompt: String,                 // the original user prompt
  steps: [{ day: Number, message: String }],
  status: String,                 // "draft" | "active" | "cancelled"
  createdAt: Date,
  updatedAt: Date
}
```

The schema lives in `src/api/models/campaign.model.js` and is exposed as a **factory function** `(mongoose) => mongoose.model("Campaign", schema)`. The `db.config.js` helper calls this factory with the Mongoose instance it loaded.

A `toJSON` method hides `__v` and renames `_id` → `id` so the API returns clean JSON.

### How it is (or isn't) used today

- `index.js` connects to Mongo **only if** `DATABASE_URL` is set.
- The legacy `server.js` calls `Campaign.create(...)` when generating a campaign, and `Campaign.findByIdAndUpdate(...)` when activating/cancelling.
- The current controllers in `src/api/controllers/` **do not** read or write Mongo at all — they go straight to the AI and the queue.

So today Mongo is mostly there as **scaffolding for the cancel-campaign flow** and as a target for the next iteration of the campaign controller. The `db.config.js` and `campaign.model.js` are wired but not exercised by the active code path.

### Mongoose connection (`src/database/db.config.js`)

Exports `{ mongoose, url, campaigns }`:
- `mongoose` — the loaded Mongoose module.
- `url` — `config.DB_URL` (i.e. the value of `DATABASE_URL`).
- `campaigns` — the Mongoose model, built by calling the factory.

The connection itself is initiated by `index.js`, **not** by the db config (intentional, so the server still starts even if Mongo is down).

---

## 11. Delivery — Telegram & Meta Graph

### Telegram

The single point of truth is `sendToTelegram(message, botToken?, chatId?)` in `src/utils/posting.utils.js`. Both the worker (scheduled sends) and `posting.controller.js` (manual sends) call it.

Telegram-specific gotchas handled here:
- **Rate limiting** (`429 Too Many Requests`) — the worker handles this with in-process retries (3 attempts) **plus** BullMQ's queue-level retries (5 attempts, exponential backoff).
- **Timeouts** — 15s axios timeout in `posting.utils.js`.
- **Empty error messages** — common with `ECONNRESET`. The worker logs the HTTP `status` and the Telegram `description` field so you can always see why a send failed.

### Meta Graph

`src/api/controllers/meta.js` posts to `https://graph.facebook.com/{META_GRAPH_VERSION}/{pageId}/feed?message=…&access_token=…`.

- **Token requirements**: a real Page post requires a **Page Access Token** issued after **Business Verification** of the Facebook app and page. Personal access tokens cannot post to a Page.
- **OpenClaw plan**: if `useOpenClaw=true`, the controller first calls OpenClaw to draft a "plan" JSON. This is currently advisory only — the request body to Meta is unchanged. The plan is returned in the response for transparency.

---

## 12. Frontend walkthrough (Angular 17)

The frontend is an Angular 17 **standalone-component** SPA, no NgModules. It uses Tailwind CSS for styling and Angular Material Icons (via the `material-icons` font).

### 12.1 Routes (`src/app/app.routes.ts`)

All routes render inside a `ShellComponent` that draws the sidebar + top nav + `<router-outlet />`:

| Path                | Component                    | Purpose                                           |
| ------------------- | ---------------------------- | ------------------------------------------------- |
| `/`                 | redirects to `/dashboard`    | Default landing page                              |
| `/dashboard`        | `DashboardComponent`         | Stats cards + recent activity                     |
| `/generate-content` | `GenerateContentComponent`   | Legacy "Generate Campaign" page (older UI)        |
| `/campaign`         | `CampaignGeneratorComponent` | New, full-featured campaign generator             |
| `/competitors`      | `CompetitorAnalysisComponent`| New, full-featured competitor analysis            |
| `/history`          | `HistoryComponent`           | List of recent generations (in-memory)            |
| `/analytics`        | `AnalyticsComponent`         | Placeholder                                       |
| `/settings`         | `SettingsComponent`          | Placeholder                                       |
| `**` (wildcard)     | redirects to `/dashboard`    | 404 fallback                                      |

All feature components are **lazy-loaded** with `loadComponent: () => import(...).then(m => m.X)`.

### 12.2 Layout

- `ShellComponent` — the application frame: a flex container with a sidebar on the left and a column on the right (top nav + main content).
- `SidebarComponent` — collapsible, with Material icons, highlights the active route, and emits a `toggleCollapse` event. The shell listens and toggles `sidebarCollapsed`.
- `TopNavComponent` — top bar with a menu button (mobile) and basic controls.

### 12.3 Core services

`src/app/core/services/api.service.ts` exposes two strongly-typed services:

- **`CampaignService`**
  - `generateCampaign(payload: CampaignRequest): Observable<CampaignApiResponse>` — POST `/generate-campaign`.
  - `sendToTelegram(message, botToken, channelId): Observable<{ success: boolean }>` — POST `/telegram/send`.
  - `parseResult(data): CampaignResult` — safely parses the response into a `CampaignResult` (handles JSON-in-string and `[object Object]` cases).
- **`CompetitorAnalysisService`**
  - `analyze(payload): Observable<{ result: string | CompetitorAnalysisResult }>` — POST `/competitor-analysis`.
  - `parseResult(data): CompetitorAnalysisResult` — same defensive parsing as above.

`src/app/core/services/dashboard.service.ts` is an in-memory store for the dashboard:
- `stats` — counts of campaigns generated, competitor reports, AI requests, success rate.
- `recentActivity` — last N actions.
- `history` — past generations.
- `incrementCampaigns()` / `incrementAnalyses()` / `addActivity(...)` / `saveHistory(...)` / `getHistory()`.

> Because this is in-memory, refreshing the browser resets the stats. Persistence (LocalStorage or a backend endpoint) is a future improvement.

`src/app/core/services/notification.service.ts` is a simple toast/banner service consumed by the `errorInterceptor` and by components on success.

`src/app/core/interceptors/error.interceptor.ts` is a **functional HTTP interceptor** that catches `HttpErrorResponse` and surfaces `error.error.error` / `error.error.message` / `error.message` to the notification service.

### 12.4 Models (`src/app/core/models/index.ts`)

The TypeScript interfaces shared by the services and the components. The most important:

- `CampaignRequest` — the form payload for `/generate-campaign` (prompt + business name/description + industry/audience/goal/tone/language/platform + optional `telegram` config).
- `CampaignResult` — the parsed result object (`title`, `overview`, `strategy`, `socialPosts[]`, `emailCampaign`, `hashtags[]`, `contentCalendar[]`, `cta`, `imageSuggestions[]`, `kpis[]`, `raw`).
- `CompetitorAnalysisRequest` / `CompetitorAnalysisResult` — same shape as the backend's JSON contract.
- `TelegramConfig` — `{ enabled, botToken, channelId }`.
- `DashboardStats`, `ActivityItem`, `HistoryItem` — for the dashboard page.

### 12.5 Validators (`src/app/core/validators/telegram.validator.ts`)

A cross-field `ValidatorFn` that requires `telegramBotToken` and `telegramChannelId` to be non-empty **only when** `telegramEnabled` is `true`. Used by `CampaignGeneratorComponent`.

### 12.6 Feature pages

- **`CampaignGeneratorComponent`** (`/campaign`) — the flagship page. A reactive form with 12 fields (business name, description, industry, audience, goal, tone, language, platform, campaign type, duration, budget, prompt). Autosaves the draft to `localStorage` every 800ms. On submit, posts to `/generate-campaign`, parses the result, stores it in a `signal`, and feeds the result into `ResultSectionCardComponent` panels. Includes a "Send to Telegram" button per section.
- **`CompetitorAnalysisComponent`** (`/competitors`) — a smaller form (company name + website URL), calls `/competitor-analysis`, and renders the result as a SWOT card, trend chips, recommendations list, and AI opportunities list.
- **`DashboardComponent`** — four `StatCardComponent` tiles + a recent-activity list.
- **`HistoryComponent`** — reads `DashboardService.getHistory()` and shows the items.
- **`AnalyticsComponent`** / **`SettingsComponent`** — placeholders.

### 12.7 Shared components

- **`AiThinkingLoaderComponent`** — animated "AI is thinking" indicator shown while waiting for `/generate-campaign` or `/competitor-analysis`.
- **`EmptyStateComponent`** — a reusable "nothing here yet" card.
- **`ResultSectionCardComponent`** — a styled section card with a copy button, used to render each part of the AI result.
- **`StatCardComponent`** — a tile for the dashboard stats.

### 12.8 Networking

- **Dev**: `proxy.conf.json` forwards `/api/*` and the bare backend endpoints to `http://localhost:3000`.
- **Prod (Docker)**: `nginx.conf` in the frontend image serves the SPA and reverse-proxies `/api/*` and the bare backend endpoints to `http://backend:3000`. Long `proxy_read_timeout: 180s` because AI calls can take up to 2 minutes.

All Angular services use **relative URLs** (`''` as base URL) so the same build works in dev (via the Angular dev-server proxy) and in Docker (via nginx). The only exception is `GenerateContentService`, which has a hard-coded `http://localhost:3000` — this is a known inconsistency flagged in §18.

### 12.9 Styling

- Tailwind CSS for utility classes, configured in `tailwind.config.js`.
- Custom theme tokens in `tailwind.css` (gradients, glass cards, surfaces, etc.).
- `npm run tailwind:build` is run before `ng serve` and `ng build` to produce `src/tailwind.generated.css`.

---

## 13. End-to-end request flows

### Flow A — Generate a multi-day campaign

1. User opens `/campaign`, fills the form, clicks **Generate Campaign**.
2. `CampaignGeneratorComponent.generate()` validates the form, builds a `CampaignRequest` payload, and calls `CampaignService.generateCampaign(payload)`.
3. `HttpClient` POSTs to `/generate-campaign`.
4. `campaignController.generateCampaign` builds a prompt asking for `Day 1:`, `Day 2:`, …, calls `callOpenClaw(prompt)` → OpenClaw → Ollama → model returns plain text.
5. Controller splits the text by `Day N:` markers → enqueues N jobs in `campaignQueue` with `delay: i * 10000` ms.
6. Controller returns `{ success, message, totalDays, response, jobs }`.
7. Angular receives the response, `parseResult()` extracts a `CampaignResult` object, the `result` signal is set, and the result section cards render.
8. After 10s, 20s, 30s, the worker sends one Telegram message per job (format: `🚀 Day N\n\n<message>`).

### Flow B — Analyze a competitor

1. User opens `/competitors`, enters a company name and/or website URL, clicks **Analyze**.
2. `CompetitorAnalysisComponent.analyze()` builds a prompt and calls `CompetitorAnalysisService.analyze(...)`.
3. `HttpClient` POSTs to `/competitor-analysis`.
4. `analysisController.competitorAnalysis` calls `callOpenClaw(prompt)` → returns text.
5. Controller strips code fences, attempts to parse JSON; falls back to `{ summary, raw }`.
6. Returns `{ result }`. Angular renders SWOT, trends, recommendations, and AI opportunities.

### Flow C — Send a single message to Telegram (manual)

1. User (in `/campaign`) clicks **Send to Telegram** on a result section.
2. `CampaignGeneratorComponent.sendSectionToTelegram(text)` calls `CampaignService.sendToTelegram(text, botToken, channelId)`.
3. `HttpClient` POSTs to `/telegram/send` with `{ message, botToken, channelId }`.
4. `postingController.sendPostToTelegram` calls `sendToTelegram(message, botToken, channelId)`.
5. `sendToTelegram` POSTs to `https://api.telegram.org/bot<token>/sendMessage`.
6. Returns `{ success: true }` or `{ success: false, error, details }`.

### Flow D — Post to a Facebook Page

1. Client → `POST /meta/post` with `{ message, pageId, accessToken, useOpenClaw=true }`.
2. `meta.postToMeta` calls `getOpenClawMetaPlan(...)` (advisory only).
3. `axios.post` to `https://graph.facebook.com/v25.0/{pageId}/feed?message=…&access_token=…`.
4. Returns `{ success, result: { id, postId, raw }, openClawPlan, openClawWarning }`.

---

## 14. Running locally (without Docker)

You need Node.js 22+, Redis 7+, MongoDB 7+, OpenClaw, and Ollama installed locally.

```bash
# 1. Start Redis
redis-server

# 2. Start Mongo (or set DATABASE_URL to an Atlas cluster)
mongod

# 3. Start OpenClaw on the host (see its docs)
#    Defaults: http://127.0.0.1:18789

# 4. Start Ollama and pull a model
ollama pull llama3

# 5. Backend
cp .env.example .env       # then fill in real tokens
npm install
npm run start:backend      # → node index.js, port 3000

# 6. Worker (separate terminal)
npm run start:worker       # → node worker.js

# 7. Frontend (separate terminal)
cd ai-marketing-frontend
npm install
npm start                  # → ng serve, port 4200, proxies /api → :3000
```

Open `http://localhost:4200` and you should see the dashboard.

---

## 15. Running with Docker Compose

```bash
# 1. Make sure .env has real values for OPENCLAW_GATEWAY_TOKEN, TELEGRAM_BOT_TOKEN, etc.

# 2. Start OpenClaw + Ollama on the host (they're not in compose)

# 3. Bring up everything
docker compose up --build
```

| Container              | URL                                            |
| ---------------------- | ---------------------------------------------- |
| `ai_marketing_frontend`| http://localhost/                              |
| `ai_marketing_backend` | http://localhost:3000/                          |
| `ai_marketing_redis`   | `redis://localhost:6379`                        |
| `ai_marketing_mongo`   | `mongodb://localhost:27017/ai_marketing`        |

The frontend container reverse-proxies `/api/*` and the bare backend endpoints to the backend container on the `ai-marketing-net` Docker network, so the same Angular build works in dev and prod.

---

## 16. Adding a new feature end-to-end (worked example)

Suppose you want a **"Generate a tweet"** feature. Here's the smallest set of changes that touches every layer:

1. **Backend — new controller** (`src/api/controllers/tweet.controller.js`):
   ```js
   const { callOpenClaw } = require("../../utils/openclaw.utils");
   exports.generateTweet = async (req, res) => {
     const { topic } = req.body;
     if (!topic) return res.status(400).json({ error: "Missing topic" });
     const prompt = `Write a single tweet (<= 240 chars) about: ${topic}. Return only the tweet.`;
     try {
       const text = await callOpenClaw(prompt);
       return res.json({ result: text });
     } catch (e) {
       return res.status(e.status || 500).json({ error: e.message, details: e.details });
     }
   };
   ```
2. **Wire it in** (`src/api/routes/routes.js`):
   ```js
   const tweetController = require("../controllers/tweet.controller");
   router.post("/tweet", tweetController.generateTweet);
   app.post("/tweet", tweetController.generateTweet);
   ```
3. **Frontend — new service** (in `src/app/core/services/api.service.ts`):
   ```ts
   @Injectable({ providedIn: 'root' })
   export class TweetService {
     private readonly http = inject(HttpClient);
     generate(topic: string) {
       return this.http.post<{ result: string }>(`/tweet`, { topic });
     }
   }
   ```
4. **Frontend — new page** in `src/app/features/tweet/` with a `TweetComponent`, register it in `app.routes.ts` and add a sidebar entry.
5. **(Optional) persist** in Mongo by creating a `Tweet` model and saving on success.
6. **Test** with `curl`:
   ```bash
   curl -X POST http://localhost:3000/tweet \
     -H "Content-Type: application/json" \
     -d '{"topic":"launching a new AI marketing tool"}'
   ```

That's the entire loop: controller → route → service → page → curl. The same pattern (with queueing and worker) is what the campaign feature uses.

---

## 17. API reference

All endpoints accept and return JSON. Errors return `{ error, details? }`.

| Method | Path                  | Body                                                        | Success                                              | Notes |
| ------ | --------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | ----- |
| GET    | `/`                   | —                                                           | `"AI Marketing Backend is running 🚀"`               | Health check |
| POST   | `/generate`           | `{ prompt: string }`                                        | `{ result: string }`                                 | Simple text generation via OpenClaw |
| POST   | `/generate-campaign`  | `{ prompt: string }`                                        | `{ success, message, totalDays, response, jobs }`   | Splits the AI output by `Day N:` and enqueues a BullMQ job per day with `delay: i*10000ms` |
| POST   | `/competitor-analysis`| `{ prompt, companyName?, websiteUrl? }`                     | `{ result: object \| string }`                       | Tries to parse JSON; falls back to `{ summary, raw }` |
| POST   | `/telegram/send`      | `{ message, botToken, channelId }`                          | `{ success: true }`                                  | Wraps errors as `{ success: false, error, details }` |
| POST   | `/meta/post`          | `{ message, pageId, accessToken, useOpenClaw? }`            | `{ success: true, result, openClawPlan?, openClawWarning? }` | Requires a Page Access Token (Business Verification) |
| POST   | `/api/...` (any of the above) | same                                          | same                                                 | All routes are also mounted under `/api/` |
| POST   | `/activate-campaign`  | `{ campaignId }`                                            | `{ message, jobs }`                                  | **Legacy** (only in `server.js`) — persists to Mongo and enqueues jobs |
| POST   | `/cancel-campaign`    | `{ campaignId }`                                            | `{ message }`                                        | **Legacy** (only in `server.js`) — removes queued jobs and sets `status=cancelled` |
| ANY    | `*` (unknown)         | —                                                           | `{ error: "Cannot METHOD /path" }` (404)             | Final fallback |

---

## 18. Known issues & housekeeping

These don't block the happy path but are worth being aware of:

| File / location                              | Issue                                                                                          | Suggested fix |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------- |
| `server.js`                                  | Legacy entry point. Imports `./models/Campaign` (wrong path) as if it were a model, but it's a factory. Also imports `node-fetch` (not in `package.json`). | Delete it, **or** rewrite to use `src/api/models/campaign.model.js` (the factory) and the queue. |
| `server.ts`                                  | Angular SSR leftover from the generator. Not used by the backend.                              | Delete. |
| `src/api/models/analysis.model.js`           | Empty file. Nothing imports it.                                                                 | Delete or fill in. |
| `src/utils/analysis.utils.js`                | Empty file. Nothing imports it.                                                                 | Delete. |
| `src/utils/campaign.utils.js` (line 61)      | Two `module.exports =` statements. The second overrides the first but with a superset, so it works. | Collapse into one. |
| `src/api/routes/routes.js`                   | Routes mounted twice (`/api/...` and at root).                                                  | Intentional — keep, but add a comment. |
| Mongo / `db.config.js` / `campaign.model.js` | Connected at startup but not used by any active controller. The legacy `server.js` does use it. | Either delete Mongo + the model + the service, **or** wire `campaign.controller.js` to persist before queueing. |
| `ai-marketing-frontend/src/app/services/generate-content.service.ts` | Hard-coded `http://localhost:3000` base URL. | Set to `''` (relative) like the other services. |
| `ai-marketing-frontend/.../telegram.js.deletethislater` | Leftover manual test script with a real token. | Delete and rotate the token. |
| `.env`                                       | Real `OPENCLAW_GATEWAY_TOKEN` and `TELEGRAM_BOT_TOKEN` are committed.                          | Move secrets to `.env.local`, Docker secrets, or CI variables. |
| `Dockerfile.worker`                          | Pins the npm registry to `https://registry.npmjs.org/` and sets `fetch-retries: 5`.             | Fine, but worth a comment explaining why. |
| `src/api/routes/routes.js`                   | Comment on `meta/post` says it requires Business Verification.                                  | Keep, but consider a friendlier 400 response when the token is missing the right scopes. |
| `/generate-campaign` delay                    | Hard-coded `delay: i * 10000` (10s per day) is a test speed.                                   | For real campaigns, change to `step.day * 24 * 60 * 60 * 1000`. |
| `dashboard.service.ts`                        | In-memory only — refreshing the browser clears the dashboard.                                  | Persist to `localStorage` or a backend endpoint. |

### If you want to keep `server.js`

A minimal patch to make it functional:

```js
// server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const CampaignFactory = require("./src/api/models/campaign.model");   // factory fn
const config = require("./src/config/config");
const campaignQueue = require("./queue");

const Campaign = CampaignFactory(mongoose);
const app = express();
app.use(cors());
app.use(express.json());

if (config.DB_URL) {
  mongoose.connect(config.DB_URL, {}).then(() => console.log("Mongo connected"));
}

// /generate-campaign → Campaign.create(...) → return campaign
// /activate-campaign → campaignQueue.add(...) for each step
// /cancel-campaign  → campaignQueue.getJobs() filter by data.campaignId → remove
//                     + Campaign.findByIdAndUpdate(id, { status: "cancelled" })

app.listen(config.PORT, () => console.log(`Server running on http://localhost:${config.PORT}`));
```

This gives a single, clean entry point and removes the duplication with `index.js`.

---

## 19. Glossary

- **OpenClaw** — a self-hosted, OpenAI-compatible AI gateway. The backend talks to it instead of calling Ollama directly. See `openclaw/openclaw.json` for its config.
- **Ollama** — the local model server. OpenClaw forwards requests to it. You can swap OpenClaw for a different gateway and Ollama for a different backend without changing the app code.
- **BullMQ** — a Redis-backed job queue for Node.js. Handles delayed jobs, retries, and concurrency.
- **Worker** — a long-running process that consumes jobs from BullMQ. In this project, it sends Telegram messages.
- **Mongoose** — the MongoDB ORM for Node.js. Used for the `Campaign` model.
- **Campaign** — a multi-day marketing plan: a name, an array of `{ day, message }` steps, and a status (`draft` / `active` / `cancelled`).
- **Job** — a single scheduled Telegram send inside a campaign. Has payload `{ day, message }` and a delay.
- **Result** — the parsed AI response for a campaign or a competitor analysis. Includes a `raw` fallback when the AI doesn't return valid JSON.
- **Shell** — the Angular app frame (sidebar + top nav + main content) inside which all routed pages render.

---

*Last updated alongside `ARCHITECTURE.md`.*