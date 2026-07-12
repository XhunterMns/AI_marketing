# AI Marketing Platform — Architecture & Code Walkthrough

This document explains the **entire project**: the layers, the role of every script, how the
frontend talks to the backend, how the backend talks to AI models (OpenClaw + Ollama),
how campaigns are scheduled, how posts are pushed to Telegram, and how everything is wired
together in Docker.

---

## 1. High-level architecture

```
┌────────────────────────────────┐        HTTP (4200)        ┌──────────────────────────────┐
│  Angular 17 Frontend           │ ───────────────────────▶ │  Express Backend (Node 20)   │
│  ai-marketing-frontend/        │ ◀─────────────────────── │  index.js (port 3000)        │
│                                │      JSON responses       │                              │
│  - generate-content            │                           │  Controllers:                │
│  - competitor-analysis         │                           │   /generate                  │
│                                │                           │   /generate-campaign         │
└────────────────────────────────┘                           │   /competitor-analysis       │
                                                            │   /meta/post                 │
                                                            │   /telegram/send             │
                                                            └──────────┬───────────────────┘
                                                                       │
                                            ┌──────────────────────────┼──────────────────────────┐
                                            │                          │                          │
                                            ▼                          ▼                          ▼
                                   ┌─────────────────┐      ┌────────────────────┐     ┌────────────────────┐
                                   │  AI Layer       │      │  Persistence       │     │  Delivery          │
                                   │                 │      │                    │     │                    │
                                   │  OpenClaw       │      │  MongoDB (Mongoose)│     │  Telegram Bot API  │
                                   │  Gateway :18789 │      │  Campaign model    │     │  sendMessage       │
                                   │       │         │      │                    │     │                    │
                                   │       ▼         │      │  Redis + BullMQ    │     │  Meta Graph API    │
                                   │  Ollama (local) │      │  campaignQueue     │     │  (Facebook page)   │
                                   │  llama3 / etc.  │      │                    │     │                    │
                                   └─────────────────┘      └────────────────────┘     └────────────────────┘
```

Three long-running services run side by side (see `docker-compose.yml`):

| Service  | Image / file         | Role                                                                    |
| -------- | -------------------- | ----------------------------------------------------------------------- |
| backend  | `Dockerfile`         | Express HTTP API (`index.js`)                                           |
| worker   | `Dockerfile.worker`  | BullMQ consumer that sends Telegram messages (`worker.js`)              |
| redis    | `redis:7`            | Queue backend for BullMQ                                                |
| mongo    | `mongo:7`            | Persistent storage for campaigns                                        |

OpenClaw itself runs on the host machine (port `18789`); `OPENCLAW_GATEWAY_URL` points to it.
Ollama also runs locally; OpenClaw talks to it under the hood (we do **not** call Ollama directly).

---

## 2. Repository layout

```
ai-marketing-backend/                       ← Backend root (Node.js)
├── index.js                                ← Express entry point (CURRENT, used in Docker)
├── server.js                               ← Legacy entry point (NOT used by Docker, broken paths)
├── server.ts                               ← Angular SSR server (unused, leftover from generator)
├── queue.js                                ← BullMQ queue setup (used by index.js + worker.js)
├── worker.js                               ← BullMQ worker (Telegram sender, retries, backoff)
├── openclaw/openclaw.json                  ← Local OpenClaw gateway config
├── src/
│   ├── api/
│   │   ├── routes/routes.js                ← Mounts all controllers under /api and at root
│   │   ├── controllers/
│   │   │   ├── generate.controller.js      ← POST /generate         (simple text generation)
│   │   │   ├── campaign.controller.js      ← POST /generate-campaign (multi-day scheduler)
│   │   │   ├── analysis.controller.js      ← POST /competitor-analysis
│   │   │   ├── meta.js                     ← POST /meta/post        (Facebook Graph)
│   │   │   └── posting.controller.js       ← POST /telegram/send
│   │   └── models/
│   │       └── campaign.model.js           ← Mongoose Campaign schema (factory function)
│   ├── config/config.js                    ← Centralized env config
│   ├── database/db.config.js               ← Mongoose connection helper
│   └── utils/
│       ├── openclaw.utils.js               ← HTTP client to OpenClaw gateway
│       ├── posting.utils.js                ← Telegram sendMessage helper (with retries/wrapping)
│       ├── campaign.utils.js               ← splitCampaignByDays + helpers
│       └── analysis.utils.js               ← (currently empty / unused)
├── Dockerfile                              ← Container for backend
├── Dockerfile.worker                       ← Container for worker
└── docker-compose.yml                      ← Orchestrates backend + worker + redis + mongo

ai-marketing-frontend/                      ← Angular 17 app (separate workspace)
├── src/app/
│   ├── app.routes.ts                       ← /generate-content, /competitor-analysis
│   ├── app.component.html                  ← just <router-outlet />
│   ├── generate-content/                   ← "Generate Campaign" UI
│   ├── competitor-analysis/                ← "Analyze Competitors" UI
│   └── services/
│       ├── generate-content.service.ts     ← POST /generate
│       ├── campaign.service.ts             ← POST /generate-campaign, /activate, /cancel
│       └── competitor-analysis.service.ts  ← POST /competitor-analysis
```

---

## 3. Layer-by-layer walkthrough

### 3.1 Frontend (Angular 17, standalone components)

The frontend is a tiny SPA with two pages and three HTTP services. It never talks to AI
directly — it only talks to the Express backend at `http://localhost:3000`.

#### `src/app/app.routes.ts`
Defines two routes:
- `/generate-content` → `GenerateContentComponent`
- `/competitor-analysis` → `CompetitorAnalysisComponent`

#### `src/app/app.component.html`
Just `<router-outlet />` — the router renders the active page.

#### `generate-content/` page
- **TS**: `prompt` and `generatedText` fields. On click, calls
  `CampaignService.generateCampaign(prompt)`. The backend's `/generate-campaign` returns
  `{ success, message, totalDays, response: <ai text>, jobs }`, so the component reads
  `res.response` (with `res.result` as a fallback) and only assigns a string to
  `generatedText` — fixing the `[object Object]` issue we saw earlier.
- **HTML**: A `<textarea>` bound with `[(ngModel)]`, a "Generate Campaign" button, and a
  `<pre>` that renders `generatedText` only when truthy (`*ngIf="generatedText"`).

#### `competitor-analysis/` page
Same pattern: textarea → button → calls `CompetitorAnalysisService.competitorAnalysis(prompt)`,
which hits `/competitor-analysis`. The backend's analysis controller returns
`{ result: <json-or-text> }`, so the component reads `res.result` and displays it.

#### Services (all `providedIn: 'root'`)
- `GenerateContentService.generatecontent(prompt)` → `POST /generate`
  *(Note: method name has a lowercase "c", not currently used by any component.)*
- `CampaignService.generateCampaign/activateCampaign/cancelCampaign` → `/generate-campaign`, `/activate-campaign`, `/cancel-campaign`
- `CompetitorAnalysisService.competitorAnalysis(prompt)` → `/competitor-analysis`

---

### 3.2 Backend entry points

#### `index.js` ✅ **the one that actually runs in Docker** (`CMD ["node", "index.js"]`)
1. Loads `express`, `cors`, config and the database helper.
2. Enables CORS + JSON body parsing.
3. If `database.url` is set (i.e. `DATABASE_URL` env var), connects Mongoose in the background.
4. Mounts routes via `require("./src/api/routes/routes")(app)`.
5. Registers a 404 fallback.
6. Starts listening on `config.PORT` (default `3000`).

#### `server.js` ❌ legacy / duplicate, **not** used by Docker
- Has its own `express` + `mongoose` setup, its own `/generate`, `/generate-campaign`,
  `/activate-campaign`, `/cancel-campaign` handlers, and its own `app.listen(3000)`.
- Imports `require("./models/Campaign")` from repo root, but the file actually lives at
  `./src/api/models/campaign.model.js` AND exports a factory `(mongoose) => Model`,
  not a ready model. So this file would crash at startup if you ran it.
- Also conflicts with `index.js` on port 3000 if both run.
- Recommendation: delete `server.js` (and `server.ts`, which is Angular SSR leftover),
  and rename `index.js` to `server.js` if you want a cleaner naming.

#### `queue.js`
Creates the BullMQ `Queue` named `campaignQueue`. It also wires default job options so any
failed job is retried automatically with exponential backoff:

```js
defaultJobOptions: {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s, 40s, 80s
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
}
```

Redis connection reads `REDIS_HOST` env (falls back to `127.0.0.1`); in Docker Compose it
becomes `redis` (the service name).

#### `worker.js` ✅ runs in `Dockerfile.worker`
Long-running process. Subscribes to `campaignQueue` and, for every job, calls
`sendToTelegram("🚀 Day N\n\n<message>")`. Features:

- Validates the job payload (throws if `message` is missing).
- Tries the Telegram API **3 times** in-process with 2s / 5s backoff for retriable errors
  (no status / 429 / 5xx).
- Runs at `concurrency: 1` to stay under Telegram's per-second flood limits.
- Logs `status` and `description` from the Telegram API on every failure so the next time
  Day 2 fails, you'll see the real reason (e.g. `status=429 Too Many Requests: retry after 7`).
- Re-throws on final failure so BullMQ records it and applies its own queue-level backoff
  (5 attempts, exponential).
- Listens for `completed` / `failed` worker events for visibility.

---

### 3.3 Routing layer — `src/api/routes/routes.js`

Exports a function that takes the Express `app` and wires every controller twice: once
under `/api/...` and once at the root. (The duplication lets clients hit either
`http://localhost:3000/generate-campaign` or `http://localhost:3000/api/generate-campaign`.)

```js
app.use("/api", router);
app.post("/generate", generateController.generate);
app.post("/generate-campaign", campaignController.generateCampaign);
...
```

---

### 3.4 Controllers (the request handlers)

All controllers are tiny: they validate input, delegate to a util / AI / queue, and
return JSON.

#### `generate.controller.js` — `POST /generate`
- Body: `{ prompt: string }`
- Calls `callOpenClaw(prompt)` → returns the raw text.
- Returns `{ result: <text> }`.

#### `campaign.controller.js` — `POST /generate-campaign`
- Body: `{ prompt: string }`
- Builds a strict prompt that tells the model to return plain text with explicit
  `Day 1:` / `Day 2:` / `Day 3:` markers.
- Calls `callOpenClaw(aiPrompt)` → returns the campaign text.
- Calls `splitCampaignByDays(text)` (regex on `Day N:` markers) to get
  `[{ day, message }, ...]`.
- For each day, enqueues a job in `campaignQueue` with payload `{ day, message }` and
  `delay: i * 10000` ms (test: 10s between days; in production you'd swap this for
  `step.day * 24 * 60 * 60 * 1000`).
- Returns `{ success, message, totalDays, response, jobs }`.
- The `response` field is the full AI text, which is what the Angular UI displays
  (this is why we changed the component to read `res.response`).

#### `analysis.controller.js` — `POST /competitor-analysis`
- Body: `{ prompt }`
- Builds a prompt that asks for strict JSON with `summary`, `competitors[]`, `trends[]`,
  `recommendations[]`.
- Calls `callOpenClaw(prompt)`.
- Returns `{ result: <string> }` — the AI text (may or may not be valid JSON, depending on
  how obedient the model is).

#### `meta.js` — `POST /meta/post`
- Body: `{ message, pageId, accessToken, useOpenClaw=true }`
- Optionally asks OpenClaw to draft a "Meta Graph plan" (currently advisory only).
- POSTs to `https://graph.facebook.com/v25.0/{pageId}/feed` with `message` + `access_token`.
- Returns the normalized Facebook response.

#### `posting.controller.js` — `POST /telegram/send`
- Body: `{ message }`
- Delegates to `sendToTelegram(message)`.
- Returns `{ success: true }` on success, or `{ success: false, error, details }` on failure.

---

### 3.5 Utilities

#### `src/utils/openclaw.utils.js` — `callOpenClaw(prompt)`
- Reads `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MODEL` from
  `src/config/config.js`.
- POSTs to `{gateway}/v1/chat/completions` with body
  `{ model, messages: [{ role: "user", content: prompt }], stream: false }`.
- Times out after 120s (slow model safeguard).
- Pulls the assistant text from `data.choices[0].message.content`.
- Wraps any error into a clean `Error("OpenClaw gateway error")` with `.status` and
  `.details` so controllers can pass them straight back to the client.

#### `src/utils/posting.utils.js` — `sendToTelegram(message)`
- Reads `TELEGRAM_BOT_TOKEN` from env and `TELEGRAM_CHAT_ID` / `TELEGRAM_GROUP_ID`
  (falling back to a hard-coded chat id).
- POSTs to `https://api.telegram.org/bot<token>/sendMessage` with 15s timeout.
- Wraps axios errors into a `Error` that carries `.status` and `.response`, so the worker
  can detect 429 / 5xx and retry.

#### `src/utils/campaign.utils.js` — `splitCampaignByDays(text)` (+ helpers)
- `splitCampaignByDays`: regex `/Day\s+(\d+):([\s\S]*?)(?=Day\s+\d+:|$)/g` to split the AI's
  plain-text campaign into `[{ day, message }, ...]`.
- `toPlainTextCampaign` / `campaignJsonToText`: optional helpers that strip code fences
  and try to parse the response as JSON, falling back to plain text. Not currently used
  by any controller, but available if you switch the campaign controller to JSON mode.

#### `src/utils/analysis.utils.js`
Currently empty. Nothing imports it. Safe to leave alone or remove.

---

### 3.6 Persistence

#### `src/database/db.config.js`
- Loads Mongoose.
- Exposes `db.mongoose`, `db.url`, `db.campaigns`.
- `db.campaigns` is built by calling the factory exported from
  `src/api/models/campaign.model.js`.

#### `src/api/models/campaign.model.js`
- Exports `(mongoose) => mongoose.model("Campaign", CampaignSchema)`.
- Schema: `{ name, prompt, steps: [{ day, message }], status }` with timestamps.
- `status` defaults to `"draft"`; can be `"active"` or `"cancelled"` (set by the legacy
  `server.js` activate/cancel handlers; the current controllers don't touch it).
- Adds a `toJSON` method that hides `__v` and renames `_id` → `id`.

> **Important**: the legacy `server.js` imports this model as if it were a Mongoose model
> (`Campaign.findById(...)`) but it's actually a factory. So `server.js` would crash.
> The new controllers (`src/api/controllers/*.js`) don't use the model — they go directly
> through the queue. The DB layer is essentially unused by the active code path. You can
> either (a) delete the model + `db.config.js` + Mongo service from `docker-compose.yml`,
> or (b) wire the campaign controller to persist the campaign before queueing jobs.

---

## 4. AI layer — OpenClaw + Ollama

This is the part that confuses people, so here's the full picture.

### What is OpenClaw?

OpenClaw is a **local AI gateway** (think of it as a private, self-hosted "OpenRouter").
It's a small HTTP server that runs on your machine and exposes an
**OpenAI-compatible** `/v1/chat/completions` endpoint.

Key config in `openclaw/openclaw.json`:
- `gateway.mode: "local"` — runs locally
- `gateway.port: 18789` — the port we hit
- `gateway.bind: "lan"` — listens on all interfaces (so Docker can reach it)
- `gateway.auth.mode: "token"` — uses bearer-token auth (set via `OPENCLAW_GATEWAY_TOKEN`)
- `gateway.http.endpoints.chatCompletions.enabled: true` — exposes `/v1/chat/completions`
- `gateway.controlUi.allowedOrigins: ["http://localhost:18889", "http://127.0.0.1:18889"]`
  — OpenClaw also has a tiny web UI on port `18889` for inspecting requests.

So our backend does **not** call Ollama directly. It calls OpenClaw. OpenClaw, in turn,
forwards the request to whatever model backend is configured (Ollama in your case).

### Why go through OpenClaw?

1. **Single config point.** Switch from Ollama to OpenAI to Anthropic by changing
   `OPENCLAW_GATEWAY_URL` / `OPENCLAW_MODEL` — no code changes.
2. **Auth + observability.** Token auth, request logging, retries are centralized.
3. **Tool/agent layer.** OpenClaw can wrap models with "skills" — you can see this in
   `meta.js` where the prompt says `Use the OpenClaw skill meta-graph-ai` and asks for a
   JSON plan. That's a hint to OpenClaw to enrich the request with a pre-defined
   meta-graph skill.

### Where Ollama fits in

Ollama is what actually runs the model (e.g. `llama3`, `minimax-m3:cloud`). Your legacy
`server.js` has hard-coded `http://localhost:11434/api/generate` (Ollama's native API),
but **the current backend (`index.js`) does not call Ollama directly** — it only calls
OpenClaw.

Concretely, the chain is:

```
Angular UI
  → POST /generate-campaign  (Express)
  → callOpenClaw(prompt)     (axios POST to :18789/v1/chat/completions)
  → OpenClaw gateway          (token auth, optional skills, logs)
  → Ollama (or another backend)
  → model generates text
  → response bubbles back up
  → splitCampaignByDays()
  → campaignQueue.add(...)   (BullMQ, persists in Redis)
  → worker.js picks it up
  → sendToTelegram(...)
```

### Environment variables

`.env.example` documents the contract:

```
PORT=3000
DATABASE_URL=

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<bearer token>
OPENCLAW_MODEL=openclaw

# Telegram
TELEGRAM_BOT_TOKEN=<bot token from @BotFather>
TELEGRAM_CHAT_ID=<numeric chat / group id, e.g. -100...>
```

In `docker-compose.yml`, `REDIS_HOST=redis` and `MONGO_URL=mongodb://mongo:27017/...`.

---

## 5. Queue layer — BullMQ + Redis

Why a queue at all? Because:
1. Generating 3 days of posts is fast, but **spacing them out** (Day 1 now, Day 2 tomorrow,
   Day 3 in 3 days) means the API request finishes in <1s but the actual sends happen
   hours/days later. A queue is the right tool for delayed work.
2. If the worker is down or Telegram is rate-limiting, jobs should **wait and retry**
   automatically. That's exactly what BullMQ does.
3. If a job fails, we want **visibility** — BullMQ tracks attempts, errors, and stack
   traces.

Flow:

```
campaign.controller.js
  ↓  for each day: campaignQueue.add("sendCampaign", { day, message }, { delay: i*10000 })
Redis (campaignQueue)
  ↓  when delay elapses
worker.js
  ↓  job handler runs sendToTelegram(...)
Telegram Bot API
```

Job-level options (from `queue.js`):
- `attempts: 5`
- `backoff: { type: "exponential", delay: 5000 }` → 5s, 10s, 20s, 40s, 80s between retries
- `removeOnComplete: { age: 24h, count: 1000 }` — keeps Redis small
- `removeOnFail: { age: 7d }` — keeps failed jobs around for inspection

---

## 6. Delivery layer — Telegram

`src/utils/posting.utils.js` is the single point of truth for talking to Telegram. The
worker calls it from the queue handler.

Telegram-specific gotchas handled in this project:
- **Rate limiting**: Telegram returns `429 Too Many Requests` when you flood. The worker
  handles this with in-process retries (3 attempts) + BullMQ's queue-level retries
  (5 attempts, exponential).
- **Timeouts**: 15s axios timeout in `posting.utils.js`, 120s in `openclaw.utils.js`.
- **Empty error messages**: axios errors where `err.message` is empty (common with
  `ECONNRESET`, network blips) — we now log the HTTP `status` and the Telegram
  `description` field, so you can always see why a send failed.

---

## 7. Deployment — `docker-compose.yml`

```yaml
backend:  node index.js                  # port 3000
worker:   node worker.js                 # no port; consumes campaignQueue
redis:    redis:7                        # port 6379
mongo:    mongo:7                        # port 27017
```

`Dockerfile` copies the project, runs `npm install`, and starts `index.js`.
`Dockerfile.worker` is the same but starts `worker.js`.

To bring everything up:
```bash
docker compose up --build
```

You also need OpenClaw (and Ollama) running on the host. They are **not** in
`docker-compose.yml` because they need direct access to your GPU / model files.

---

## 8. End-to-end flows

### Flow A — Generate a campaign
1. User opens `/generate-content`, types a prompt, clicks **Generate Campaign**.
2. Angular `GenerateContentComponent.generateCampaign()` → `CampaignService.generateCampaign(prompt)` → `POST http://localhost:3000/generate-campaign`.
3. Express routes it to `campaignController.generateCampaign`.
4. Controller builds the prompt, calls `callOpenClaw(prompt)` → OpenClaw → Ollama → model returns plain text campaign.
5. Controller splits the text by `Day N:` markers → enqueues 3 jobs in `campaignQueue` with 10s delays.
6. Controller returns `{ success, message, totalDays, response, jobs }`.
7. Angular reads `res.response` and renders it inside the `<pre>`.
8. After 10s, 20s, 30s, the worker sends one Telegram message per job.

### Flow B — Analyze competitors
1. User opens `/competitor-analysis`, types a prompt, clicks **Analyze Competitors**.
2. Angular → `CompetitorAnalysisService.competitorAnalysis(prompt)` → `POST /competitor-analysis`.
3. `analysisController.competitorAnalysis` → `callOpenClaw(prompt)` → returns raw text.
4. Returns `{ result: <text> }`. Angular renders it.

### Flow C — Manually send a message to Telegram
1. Any client → `POST /telegram/send` with `{ message }`.
2. `postingController.sendPostToTelegram` → `sendToTelegram(message)`.
3. Returns `{ success: true }`.

### Flow D — Post to a Facebook page
1. Client → `POST /meta/post` with `{ message, pageId, accessToken }`.
2. `meta.postToMeta` → optional OpenClaw "plan" → `axios.post` to
   `https://graph.facebook.com/v25.0/{pageId}/feed?message=...&access_token=...`.
3. Returns Facebook's normalized response.

---

## 9. Things that are inconsistent or unused (housekeeping)

These were spotted during the audit but do **not** block the happy path:

| File / line                                | Issue                                                                                   | Fix suggestion                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `server.js`                                | Legacy entry point. Imports `./models/Campaign` (doesn't exist) as if it were a model, but it's a factory `(mongoose) => Model`. Imports `node-fetch` (not in `package.json`). | Delete `server.js`. Or rewrite it to use `src/api/models/campaign.model`. |
| `server.ts`                                | Angular SSR leftover from the generator. Not used by the backend.                        | Delete.                                                       |
| `src/api/models/analysis.model.js`         | Empty file. Nothing imports it.                                                         | Delete or fill in.                                            |
| `src/utils/analysis.utils.js`              | Empty file. Nothing imports it.                                                         | Delete.                                                       |
| `src/utils/campaign.utils.js` line 61      | Two `module.exports =` statements. The second overrides the first, but with a superset, so it's effectively OK. | Collapse to one.                                              |
| `src/api/routes/routes.js`                 | Routes are mounted twice (under `/api` and at root). Intentional duplication.            | OK as-is, but worth a comment.                                |
| `src/database/db.config.js` + model       | The MongoDB layer is not used by any active controller — `index.js` doesn't connect, `campaign.controller.js` doesn't persist. | Either delete Mongo + the model, or persist the campaign in `campaign.controller.js` before queueing. |
| `ai-marketing-frontend/telegram.js.deletethislater` | A leftover manual test script at the root of the frontend workspace, with a real token in it. | Delete it; the token is also leaked into `.env`.              |
| `.env` line 6                              | Real `OPENCLAW_GATEWAY_TOKEN` and `TELEGRAM_BOT_TOKEN` are committed.                    | Move secrets out of `.env`, into `.env.local` / Docker secrets / CI variables. |

### Concrete fix for `server.js` (if you want to keep it)

If you'd rather **fix** `server.js` than delete it, here's the minimal patch:

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

// connect mongoose
if (config.DB_URL) {
  mongoose.connect(config.DB_URL, {}).then(() => console.log("Mongo connected"));
}

app.post("/generate-campaign", async (req, res) => { /* same as before */ });
app.post("/activate-campaign", async (req, res) => { /* same as before */ });
app.post("/cancel-campaign",  async (req, res) => { /* same as before */ });

app.listen(config.PORT, () => console.log(`Server running on http://localhost:${config.PORT}`));
```

That gives you a single, clean entry point and removes the duplication with `index.js`.

---

## 10. Quick reference — what each script does

| File                                            | Role                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `index.js`                                      | Express entry point. Loads config, DB, routes, listens on `PORT`.                         |
| `server.js`                                     | ⚠️ Legacy duplicate of `index.js`. Not used by Docker. Delete or rewrite.                 |
| `server.ts`                                     | Angular SSR leftover. Not used by backend.                                                |
| `queue.js`                                      | Creates BullMQ `campaignQueue` + default retry/backoff.                                   |
| `worker.js`                                     | BullMQ consumer. Sends Telegram messages with retries + concurrency=1.                   |
| `src/api/routes/routes.js`                      | Wires every controller under `/api/*` and at the root.                                    |
| `src/api/controllers/generate.controller.js`    | `POST /generate` — simple text gen via OpenClaw.                                          |
| `src/api/controllers/campaign.controller.js`    | `POST /generate-campaign` — splits AI text by `Day N:` and enqueues Telegram jobs.       |
| `src/api/controllers/analysis.controller.js`    | `POST /competitor-analysis` — AI text gen for competitor analysis.                        |
| `src/api/controllers/meta.js`                   | `POST /meta/post` — Facebook Graph API.                                                  |
| `src/api/controllers/posting.controller.js`     | `POST /telegram/send` — direct Telegram send.                                             |
| `src/api/models/campaign.model.js`              | Mongoose Campaign schema (factory). Currently unused by active controllers.              |
| `src/config/config.js`                          | Centralized env config (PORT, DB_URL, OpenClaw, Telegram).                               |
| `src/database/db.config.js`                     | Mongoose connection helper (currently unused by active controllers).                       |
| `src/utils/openclaw.utils.js`                   | `callOpenClaw(prompt)` — POSTs to OpenClaw's `/v1/chat/completions`.                      |
| `src/utils/posting.utils.js`                    | `sendToTelegram(message)` — POSTs to Telegram `sendMessage`.                              |
| `src/utils/campaign.utils.js`                   | `splitCampaignByDays(text)` + JSON helpers.                                               |
| `src/utils/analysis.utils.js`                   | Empty.                                                                                    |
| `openclaw/openclaw.json`                        | OpenClaw gateway config (port 18789, token auth, `/v1/chat/completions` enabled).         |
| `Dockerfile`                                    | Builds the backend image (`CMD ["node", "index.js"]`).                                    |
| `Dockerfile.worker`                             | Builds the worker image (`CMD ["node", "worker.js"]`).                                    |
| `docker-compose.yml`                            | Spins up `backend`, `worker`, `redis`, `mongo`.                                           |
| `ai-marketing-frontend/...`                     | Angular 17 SPA with `/generate-content` and `/competitor-analysis` pages.                  |