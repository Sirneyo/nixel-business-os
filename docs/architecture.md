# Technical Architecture

Nixel Business OS — Starter Edition is a two-part application:

- **Backend** — Python, FastAPI, SQLAlchemy 2.0, SQLite (PostgreSQL-ready), APScheduler. One process serves the API and runs all background work.
- **Frontend** — React 18 + Vite + TypeScript + Tailwind. A single-page app that talks to the backend over JSON, with the API base URL taken from the `VITE_API_URL` environment variable (defaulting to `http://localhost:8000`).

## Backend structure

```
backend/
├── .env.example              # every environment variable, documented
├── requirements.txt
└── app/
    ├── main.py               # FastAPI app, CORS, lifespan (init DB → seed → start scheduler), routers
    ├── config.py             # pydantic-settings Settings, read from .env / environment
    ├── db.py                 # engine, sessions, init_db(), additive dev migration helper
    ├── models.py             # all SQLAlchemy models
    ├── schemas.py            # Pydantic request schemas (validation)
    ├── serializers.py        # plain-dict response serialization
    ├── emailing.py           # block → email-safe HTML rendering, {{merge_field}} substitution
    ├── seed.py               # sample workspace seeding (seed_if_empty / reseed_samples)
    ├── providers/            # swappable external capabilities (see below)
    │   ├── __init__.py       # provider factories
    │   ├── lead_search.py    # DemoLeadSearch, GooglePlacesSearch
    │   ├── website_research.py  # DemoWebsiteResearcher, LiveWebsiteResearcher
    │   ├── email_verify.py   # DemoEmailVerifier, BuiltinEmailVerifier (dnspython MX)
    │   ├── ai.py             # HeuristicScorer, AnthropicScorer
    │   └── email_sender.py   # DemoEmailSender, SmtpEmailSender
    ├── engine/               # the moving parts
    │   ├── leadgen.py        # the 7-stage Lead Generation Engine (background thread)
    │   ├── scheduler.py      # APScheduler background tick
    │   ├── campaigns.py      # campaign send processing (windows, limits, sequences)
    │   ├── automations.py    # triggers, step execution, enrollments
    │   └── sending.py        # single choke point for every outbound email
    └── routers/              # one router per module
        ├── dashboard.py      # GET /api/dashboard
        ├── engine.py         # /api/engine/* (runs, stages, live events, cancel)
        ├── leads.py          # /api/leads/* (workspace: CRUD, approve, export, route)
        ├── inbound.py        # /api/inbound/* (webhook, status, recent)
        ├── templates.py      # /api/templates/* (builder: CRUD, preview, merge fields, test send)
        ├── campaigns.py      # /api/campaigns/* (CRUD, start/pause, members, sends, run-tick)
        ├── automations.py    # /api/automations/* (CRUD, activate, enroll, test-run, logs)
        ├── pipeline.py       # /api/pipeline/* (board, opportunity detail, stage moves)
        └── settings.py       # /api/settings (provider status, onboarding, profile)
```

### Startup sequence

`main.py` uses a FastAPI lifespan context: `init_db()` creates all tables (plus a light additive migration that adds any missing columns — `db.sync_missing_columns()`), `seed_if_empty()` builds the sample workspace if the database is empty, then `start_scheduler()` starts the background tick. On shutdown the scheduler is stopped. A global exception handler converts unhandled errors into JSON 500 responses so CORS headers survive and the frontend can display the real error.

## The provider factory pattern

Every external capability is an abstract interface with at least two implementations: a **demo provider** that simulates realistic results and a **real provider** driven by environment variables. `app/providers/__init__.py` contains one factory per capability:

| Factory | Returns real provider when | Otherwise |
|---|---|---|
| `get_lead_search()` | `DEMO_MODE=false` and `LEAD_SEARCH_PROVIDER=google_places` with a key | `DemoLeadSearch` |
| `get_website_researcher()` | `DEMO_MODE=false` | `DemoWebsiteResearcher` |
| `get_email_verifier()` | not demo mode and `EMAIL_VERIFY_MODE` is not `demo` | `DemoEmailVerifier` |
| `get_lead_scorer()` | `DEMO_MODE=false` and `ANTHROPIC_API_KEY` set | `HeuristicScorer` |
| `get_email_sender()` | `DEMO_MODE=false` and `SMTP_HOST` + `SMTP_FROM_EMAIL` set | `DemoEmailSender` |

Factories are called at the point of use (each engine run, each send), so configuration changes take effect on restart without any re-wiring. `AnthropicScorer` additionally falls back to the heuristic scorer on any API failure so a provider outage never breaks the pipeline.

## Background scheduler

`engine/scheduler.py` runs a single APScheduler `BackgroundScheduler` job (`engine-tick`) every `SCHEDULER_INTERVAL_SECONDS` (default 30, floor of 5, `max_instances=1`, `coalesce=True`). Each tick:

1. `process_campaigns(db)` — for every `running` campaign inside its send window/days and under its daily limit, sends the next due sequence email to each member, advances their step, and schedules the next send after the step's `delay_days`. A reply stops the member's sequence.
2. `process_enrollments(db)` — advances every due automation enrollment, executing consecutive steps until it hits a `wait`, a stop (e.g. `check_replied` found a reply), or the end.

The scheduler lives **inside the uvicorn process**. Run exactly one worker (see [installation.md](installation.md)) or ticks will fire once per worker. `POST /api/campaigns/run-tick` triggers campaign processing immediately, which is handy for testing.

## Engine runs: threading + polled events

`POST /api/engine/runs` creates an `EngineRun` row and starts a **daemon background thread** (`engine/leadgen.py: start_run`) that executes the 7-stage pipeline with its own database session. Only one run may be queued/running at a time (the API returns 409 otherwise).

Progress is observable without websockets:

- Every action appends a `RunEvent` row (stage, agent name, level, message, company) — the run's live activity feed.
- Per-stage counters (`discovered`, `researched`, `contacts_found`, `emails_verified`, `qualified`, `rejected`, `saved`) and `current_stage` are updated on the run row as it goes.
- The frontend polls `GET /api/engine/runs/{id}?after_event_id=<last seen>` and receives only new events (plus the current run state and saved leads). Incremental polling keeps payloads small.
- `POST /api/engine/runs/{id}/cancel` sets the status to `cancelled`; the worker thread checks for cancellation between leads and exits cleanly.

## Frontend structure

The frontend is a standard Vite + React 18 + TypeScript app (`npm install`, `npm run dev` on port 5173). It is organised around one view per module — Dashboard, Live Engine, Lead Workspace, Inbound, Email Builder, Campaigns, Automations, Pipeline, Settings — with a shared API client that reads `VITE_API_URL` (default `http://localhost:8000`). The Live Engine view polls the run endpoint on an interval while a run is active; everything else uses plain request/response fetches. Sample data is visually badged wherever `is_sample` is true.

## Database schema summary

SQLite by default (`nixel_starter.db`, created automatically); any SQLAlchemy URL works via `DATABASE_URL`.

| Table | Purpose | Key relationships |
|---|---|---|
| `settings` | Key/value app settings (onboarding profile, webhook key override) | — |
| `leads` | Every lead: contact, email + verification status, research summary, score, qualification note, review status, source (`engine`/`inbound`/`manual`), `is_sample` | → `engine_runs`; ← `campaign_leads`, `opportunities` |
| `engine_runs` | One lead-generation run: brief, status, current stage, live counters | ← `run_events`, `leads` |
| `run_events` | One line of the live activity feed (stage, agent, level, message) | → `engine_runs` |
| `email_templates` | Block-based templates (JSON `blocks`, subject) | ← `campaign_steps`, `email_sends` |
| `campaigns` | Sequence container: status, sender, daily limit, send window/days | ← `campaign_steps`, `campaign_leads`, `email_sends` |
| `campaign_steps` | Ordered steps: template + `delay_days` | → `campaigns`, `email_templates` |
| `campaign_leads` | Membership + sequence position (`current_step`, `next_send_at`, status) — unique per campaign+lead | → `campaigns`, `leads` |
| `email_sends` | Log of every email sent or simulated (subject, status, opened, replied) | → `leads`, `campaigns?`, `automations?`, `email_templates?` |
| `automations` | Trigger + status + `simulation_mode` | ← `automation_steps`, `automation_enrollments` |
| `automation_steps` | Ordered steps: `kind` + JSON `config` | → `automations` |
| `automation_enrollments` | One lead's progress through an automation (`current_step`, `next_eligible_at`) — unique per automation+lead | → `automations`, `leads` |
| `automation_logs` | Human-readable log of every automation action (incl. `[Simulated]`) | → `automations`, `leads?` |
| `opportunities` | Pipeline cards: stage, value, notes — one per lead | → `leads` (unique) |
| `activity_logs` | Cross-module activity history (dashboard feed, opportunity timeline) | → `leads?` |

## How to extend

### Add a provider (e.g. a new search source)

1. In the relevant `app/providers/*.py` file, subclass the interface (e.g. `LeadSearchProvider`) and implement its method (`search(...) -> list[BusinessResult]`). Give it a human-readable `name` — it appears in the live activity feed.
2. Add any credentials to `app/config.py` as new `Settings` fields and document them in `.env.example`.
3. Update the matching factory in `app/providers/__init__.py` to return your provider when configured (and keep the demo fallback).

The engine, workspace and UI need no changes — they only ever see the interface.

### Add an automation step kind

1. In `app/engine/automations.py`, add your kind to `STEP_KINDS` (key + human label; the label appears in the automation builder UI).
2. Add a branch in `_execute_step()`. Respect `automation.simulation_mode` (log a `[Simulated]` line and do nothing external), log the outcome with `_log(...)`, and return `True` to continue to the next step immediately or `False` to pause/stop.
3. Document the step's expected JSON `config` shape (e.g. `{"template_id": 1}`) — the router validates kinds against `STEP_KINDS` automatically.

### Add a pipeline stage

1. Add the stage key to `PIPELINE_STAGES` in `app/models.py` (order matters — it defines board column order).
2. Add its display label to `STAGE_LABELS` in `app/routers/pipeline.py`.
3. The board endpoint, stage validation and activity messages pick it up automatically; add the column styling in the frontend pipeline view if it uses per-stage colours.
