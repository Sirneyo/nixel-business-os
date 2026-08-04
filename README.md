# Nixel Business OS — Starter Edition

A real, working business system that demonstrates connected AI agents working together across lead generation, research, verification, outreach, automation and pipeline management — in one place, on your own machine.

This is the **Starter Edition**: an open, customisable foundation you can download, run and adapt. It runs entirely in **Demo Mode with zero configuration** — search, verification, AI scoring and email sending are all simulated with clearly labelled sample data, so you can explore every module safely before connecting anything real. When you are ready, real providers plug in through environment variables: Anthropic (Claude) for AI lead scoring, Google Places for business search, built-in DNS/MX email verification, and any SMTP provider for sending.

Nixel offers professional installation, security hardening, integrations and advanced customisation for teams who want this running in production. The Starter Edition is yours to learn from and build on.

## The 7 modules

| Module | What it does |
|---|---|
| **Lead Generation Engine** | Enter a search brief and watch a run move through seven live, visible stages — Searching, Discovering, Researching, Contacts, Verifying, Assessing, Saving — with a real-time activity feed showing each agent working. |
| **Verified Lead Workspace** | Every lead the engine finds (or that arrives inbound) lands here with its email verification status, research summary, relevance score and a written explanation of why it was qualified or rejected. Search, filter, edit, approve, reject, export to CSV, add to campaigns or send to the pipeline. |
| **Inbound Lead Capture** | A webhook endpoint (`POST /api/inbound/lead`, protected by an `X-API-Key` header) that connects your website forms and external systems straight into the workspace, and can trigger automations the moment a lead arrives. |
| **Campaign Engine** | Multi-step email sequences with per-campaign daily limits, send windows, send days and step delays. The background scheduler sends due emails automatically; in demo mode sends are simulated and engagement (opens/replies) is modelled so results feel real. |
| **Email Builder** | Block-based email templates (headings, text, buttons, dividers, footers) rendered to email-safe HTML, with `{{merge_fields}}` for personalisation, live preview and test sends. |
| **Automation Engine** | Readable, linear automations: a trigger (lead qualified, lead approved, inbound lead, or manual) followed by steps — send email, add to campaign, wait, check for a reply, create a pipeline opportunity, add a note. Simulation mode logs everything without doing anything external. |
| **Opportunity Pipeline** | A Kanban board from New Lead through Contacted, Replied, Qualified, Meeting Booked, Proposal Sent and Negotiation to Won/Lost, with deal values, notes and a full activity history per opportunity. |

A founder dashboard ties it together with live KPIs (total leads, verified emails, replies, open opportunities, won deals) and a cross-module activity feed.

## Quick start (under 5 minutes, no configuration)

Prerequisites: **Python 3.11+** and **Node 18+**.

### 1. Start the backend

**Windows (PowerShell):**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

The API is now running at http://localhost:8000. On first start it creates the SQLite database file `nixel_starter.db` automatically and seeds a clearly labelled sample workspace. Check it is alive: http://localhost:8000/api/health

### 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. A short onboarding asks about your business and rebuilds the sample data around your own market. That's it — you are in Demo Mode, and everything works: run the engine, review leads, build emails, start campaigns, watch automations, move deals through the pipeline. Nothing leaves your machine.

When you want real providers, copy `backend/.env.example` to `backend/.env`, add your keys and set `DEMO_MODE=false`. See [docs/configuration.md](docs/configuration.md).

## Screenshots

*Screenshots coming soon — the Live Engine view, the Verified Lead Workspace, the Email Builder and the Opportunity Pipeline will be shown here.*

## Documentation

- [System overview & how information flows](docs/overview.md)
- [Technical architecture](docs/architecture.md)
- [Installation (local & production)](docs/installation.md)
- [Configuration & providers](docs/configuration.md)
- [Security checklist](docs/security-checklist.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Example: inbound lead capture form](docs/examples/inbound-form.html)

## Disclaimer

> Nixel Business OS — Starter Edition is provided as a customisable starter system for demonstration, development and educational use. It should not be treated as automatically production-ready. Before storing real customer information, sending campaigns or connecting business systems, users are responsible for completing appropriate security, privacy, compliance, deliverability and infrastructure reviews. Nixel is not responsible for data loss, misuse, unauthorised access, spam activity, configuration errors or issues resulting from an improperly secured deployment.
