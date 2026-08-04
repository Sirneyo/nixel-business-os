# System Overview

Nixel Business OS — Starter Edition is a connected set of AI agents and business tools that take a lead from "we should find customers like X" all the way to a deal on a pipeline board. This page explains how information flows through the system and how demo and live providers differ.

## How information flows

Everything starts with a **search brief** — a short description of who you want to find (industry, keywords, location, business type, target customer, extra criteria, and how many leads you want). From there, one engine run moves through seven live, visible stages. Each stage is worked by a named agent, and every action is streamed into a live activity feed you can watch in real time.

```
Search brief
    │
    ▼
1. Searching      — the Lead Scout queries the search provider for candidate businesses
    │
    ▼
2. Discovering    — each candidate is checked against your existing workspace
    │               (duplicates by website or company name are skipped)
    ▼
3. Researching    — the Website Researcher reviews the company's website
    │               (homepage, /about, /contact, /team) and writes a research summary
    ▼
4. Contacts       — the Contact Finder extracts a named contact, role and email address
    │
    ▼
5. Verifying      — the Email Validator checks each address
    │               (syntax → disposable-domain → DNS/MX; result: valid / risky / invalid / not_found)
    ▼
6. Assessing      — the Qualification Analyst scores relevance 0–100 against your brief
    │               and always writes a one-line explanation of WHY
    ▼
7. Saving         — every lead is saved to the Verified Lead Workspace,
                    marked qualified or rejected (rejected leads are kept for review)
```

### After the engine: the workspace and beyond

The **Verified Lead Workspace** is the single home for every lead, whatever its source (`engine`, `inbound`, `manual`). Each lead carries its email status, verification detail, research summary, relevance score and qualification note. From the workspace you can:

- **Approve or reject** leads (approving fires the `lead_approved` automation trigger),
- **Add leads to a campaign** — the Campaign Engine then sends the sequence step by step, inside the campaign's send window, send days and daily limit, driven by the background scheduler,
- **Send leads to the pipeline** — creating opportunities on the Kanban board,
- **Export to CSV** for use anywhere else.

**Inbound leads** arrive through the webhook (`POST /api/inbound/lead`) from your website forms or external tools, land in the same workspace flagged `inbound`, and can immediately fire the `inbound_lead` automation trigger.

**Automations** connect the modules: a trigger enrolls a lead, then linear steps run in order — send an email, add to a campaign, wait some days, check whether the lead replied (and stop if so), create a pipeline opportunity, add a note. The same background scheduler that sends campaign emails advances automation steps.

**The Opportunity Pipeline** is the end of the journey: opportunities move through New Lead → Contacted → Replied → Qualified → Meeting Booked → Proposal Sent → Negotiation → Won / Lost, each with a value, notes, the lead's full research context, email history and an activity timeline.

## Demo Mode vs live providers

The app ships with `DEMO_MODE=true`. In demo mode **every external capability is simulated by a built-in provider** — no keys, no network calls to paid services, no emails leaving your machine:

| Capability | Demo provider | Live provider (env-configured) |
|---|---|---|
| Business search | Demo Search — fabricates plausible businesses from your brief | Google Places Text Search (`GOOGLE_PLACES_API_KEY`) |
| Website research | Demo Website Research — consistent, plausible summaries and contacts | Live Website Research — fetches real pages with httpx |
| Email verification | Demo Verifier — simulated valid/risky/invalid results | Built-in Verifier — real syntax + disposable-domain + DNS/MX checks (dnspython) |
| AI lead scoring | Built-in heuristic scorer with written explanations | Anthropic Claude (`ANTHROPIC_API_KEY`) — falls back to the heuristic scorer if the API errors |
| Email sending | Demo Sender — sends are recorded but never leave the system | Any SMTP provider (`SMTP_*` variables) — AWS SES, Postmark, Mailgun, etc. |

Two important behaviours:

1. **`DEMO_MODE=true` wins over everything.** Even if you have configured real keys, demo mode forces the simulated providers. This makes it safe to keep keys in `.env` while you experiment. Set `DEMO_MODE=false` to activate whichever real providers are configured; anything left unconfigured still falls back to its demo/built-in provider.
2. **Providers are independent.** You can go live with email verification and AI scoring while search and sending stay simulated — each capability is chosen separately at the moment it is used.

In demo mode the engine also paces itself slightly (a ~0.35 s delay between actions) so the live feed is watchable rather than instant, and campaign sends simulate realistic engagement (some opens and replies) so the reporting screens show meaningful numbers.

## Sample data labelling

On first start (an empty database), the system seeds a complete sample workspace: a finished engine run with its event trail, sample leads, an inbound lead, three email templates, a campaign with send history, an automation and a populated pipeline.

Every seeded row is flagged **`is_sample=true`** in the database and labelled **"Sample"** in the UI, so demo content is never confused with your real results. When you complete onboarding, the sample workspace is rebuilt around *your* industry and location so the examples feel relevant. Editing a sample campaign, automation, template or opportunity clears its sample flag — it becomes yours. Deleting the database file and restarting recreates the samples from scratch.
