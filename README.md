# Nixel Business OS — Starter Edition

A real, working business system: connected AI agents handling lead generation, research, email verification, outreach, automation and pipeline management — in one place, on your own machine.

It **works the moment you install it**. Lead search runs on a free built-in engine (OpenStreetMap) with zero signup, website research and email verification are built in, and a rule-based scorer qualifies leads out of the box. When you're ready for more power, paste your keys into **Settings → Connections** inside the app — Google Places for deeper business search, Claude (Anthropic) for AI lead scoring, and any SMTP provider for real email sending. Each capability switches on instantly; no restarts, no config files required.

Nixel offers professional installation, security hardening, integrations and advanced customisation for teams who want this running in production — [nixelai.com](https://nixelai.com).

## The 7 modules

| Module | What it does |
|---|---|
| **Lead Generation Engine** | Enter a search brief and watch a run move through seven live, visible stages — Searching, Discovering, Researching, Contacts, Verifying, Assessing, Saving — with a real-time activity feed showing each agent working. |
| **Verified Lead Workspace** | Every lead lands here with its email verification status, research summary, relevance score and a written explanation of why it qualified or was rejected. Search, filter, edit, approve, reject, export to CSV, add to campaigns or send to the pipeline. |
| **Inbound Lead Capture** | A webhook endpoint (`POST /api/inbound/lead`, protected by an `X-API-Key` header) that connects your website forms straight into the workspace and can trigger automations the moment a lead arrives. A working example form is in [examples/inbound-form.html](examples/inbound-form.html). |
| **Campaign Engine** | Multi-step email sequences with per-campaign daily limits, send windows, send days and step delays. The background scheduler sends due emails automatically once SMTP is connected. |
| **Email Builder** | Block-based email templates (headings, text, buttons, dividers, footers) rendered to email-safe HTML, with `{{merge_fields}}` for personalisation, live preview and test sends. |
| **Automation Engine** | Readable, linear automations: a trigger (lead qualified, lead approved, inbound lead, or manual) followed by steps — send email, add to campaign, wait, check for a reply, create a pipeline opportunity, add a note. Simulation mode logs everything before you switch an automation live. |
| **Opportunity Pipeline** | A Kanban board from New Lead through to Won/Lost, with deal values, notes and a full activity history per opportunity. |

A dashboard ties it together with live KPIs and a cross-module activity feed.

## Quick start (under 10 minutes)

Prerequisites: **Python 3.11+** and **Node 18+**.

### 1. Start the backend

**Windows (PowerShell):**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app
```

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app
```

The API is now at http://localhost:8000 (health check: http://localhost:8000/api/health). The SQLite database file `backend/nixel_starter.db` is created automatically on first start.

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Onboarding walks you through creating your account (email + password), saving your **recovery key**, and two quick questions about your business — then you're in. Run the engine, review leads, build emails, create campaigns and automations, move deals through the pipeline.

## Accounts, passwords & recovery

- The first (and only) account is created during onboarding. The password is stored as a salted PBKDF2 hash in the local database — never in plain text.
- **Forgot the password?** Click *"Use your recovery key"* on the sign-in screen and enter the `NIXL-…` key shown at signup. You'll set a new password and receive a fresh recovery key.
- **Lost both?** Whoever controls the installation can reset from the `backend/` folder: `.venv\Scripts\python -m app.reset_password` (prints a new password and recovery key).

## Connecting real services

Everything is configured inside the app at **Settings → Connections** (stored in the local database; saved keys are never displayed again):

| Connection | Unlocks | Get it from |
|---|---|---|
| Google Places API key | Deeper lead search than the built-in OpenStreetMap engine | console.cloud.google.com (enable "Places API") |
| Claude API key | AI lead scoring with written reasoning | console.anthropic.com |
| SMTP credentials | Real email sending for campaigns, automations and tests | Your email provider (AWS SES, Postmark, Mailgun, SendGrid, Google Workspace, …) |

Environment variables in `backend/.env` (see [backend/.env.example](backend/.env.example)) are supported as a fallback for server deployments — values saved in Settings take precedence.

## Documentation

The full user guide — installation, a tour of every screen with real screenshots, connections, deployment and troubleshooting — is the PDF in this folder: **Nixel-Business-OS-Guide.pdf**.

## Deploying to a server (summary)

1. Copy the folder to the server, repeat the install, and build the frontend (`npm run build` → serve `frontend/dist`).
2. Run the backend as a service (systemd / NSSM) on `127.0.0.1:8000` and reverse-proxy `/api` to it (nginx or Caddy) with HTTPS.
3. Set `PUBLIC_BASE_URL` and `CORS_ORIGINS` in `backend/.env` to your https address.
4. Your whole workspace — account, keys, data — lives in the single file `backend/nixel_starter.db`. Copy it to move or back up (back it up regularly, with the backend stopped).

Before exposing it to the internet: HTTPS on, firewall allowing only web traffic, the database file readable only by the service account, and a real look at your local privacy/anti-spam obligations before emailing real people.

## Disclaimer

> Nixel Business OS — Starter Edition is provided as a customisable starter system for demonstration, development and educational use. It should not be treated as automatically production-ready. Before storing real customer information, sending campaigns or connecting business systems, users are responsible for completing appropriate security, privacy, compliance, deliverability and infrastructure reviews. Nixel is not responsible for data loss, misuse, unauthorised access, spam activity, configuration errors or issues resulting from an improperly secured deployment.
