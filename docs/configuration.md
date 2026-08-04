# Configuration

All configuration lives in environment variables, read from `backend/.env` (copy `backend/.env.example` to get started). **Every external connection is optional** — with no configuration at all the app runs in Demo Mode with simulated providers. Restart the backend after changing `.env`.

## Environment variable reference

| Variable | Default | Purpose | Where to get it |
|---|---|---|---|
| `DATABASE_URL` | `sqlite:///./nixel_starter.db` | SQLAlchemy database URL. SQLite works out of the box; use `postgresql+psycopg://user:password@host:5432/nixel_starter` for production. | You choose. For Postgres, from your database server/host. |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | The backend's public URL — used for the webhook endpoint shown in the UI and tracking links. | Your own domain once deployed. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of origins allowed to call the API (your frontend URL). Must match exactly (scheme + host + port). | Your frontend's URL(s). |
| `DEMO_MODE` | `true` | Forces simulated providers for search, verification, AI scoring and email sending — even if keys are present. Set `false` to use configured real providers. | You choose. |
| `INBOUND_WEBHOOK_KEY` | *(empty)* | Shared secret required in the `X-API-Key` header by the inbound lead webhook. Empty = webhook disabled (returns 503). | Generate it yourself (below). |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key for Claude-based lead qualification and scoring. Empty = built-in heuristic scorer. | https://console.anthropic.com → API Keys. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Which Claude model scores leads. | Anthropic's model list in the console/docs. |
| `LEAD_SEARCH_PROVIDER` | *(empty)* | Real business-search provider. Currently supported value: `google_places`. Empty = demo search. | Set to `google_places`. |
| `GOOGLE_PLACES_API_KEY` | *(empty)* | API key for Google Places Text Search. | Google Cloud Console (below). |
| `EMAIL_VERIFY_MODE` | `builtin` | `builtin` = real syntax + disposable-domain + DNS/MX checks (no key needed). `demo` = simulated results (no DNS lookups). | You choose. |
| `SMTP_HOST` | *(empty)* | SMTP server hostname. Empty = sends are simulated. | Your email provider (SES, Postmark, Mailgun, Google Workspace, …). |
| `SMTP_PORT` | `587` | SMTP port. The sender uses STARTTLS, for which 587 is the standard port. | Your email provider's docs. |
| `SMTP_USERNAME` | *(empty)* | SMTP username (optional — some relays are IP-authenticated). | Your email provider. |
| `SMTP_PASSWORD` | *(empty)* | SMTP password. | Your email provider. |
| `SMTP_FROM_EMAIL` | *(empty)* | The From address for outgoing mail. Required (with `SMTP_HOST`) for real sending. | An address on a domain you have verified with your provider. |
| `SMTP_FROM_NAME` | *(empty)* | Friendly From name (e.g. `Alex at Yourco`). | You choose. |
| `SCHEDULER_INTERVAL_SECONDS` | `30` | Seconds between background engine ticks (campaign sends + automation steps). Values below 5 are raised to 5. | You choose. |

Provider status is always visible in the app's Settings page (`GET /api/settings`) as configured/not-configured — secret values are never echoed back by the API.

## AI provider setup (Anthropic)

1. Create an account at https://console.anthropic.com and generate an API key.
2. In `backend/.env`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-5
   DEMO_MODE=false
   ```

3. Restart the backend. Engine runs now send each candidate's research to Claude, which returns a 0–100 score, a qualified/rejected decision and a one-sentence explanation.

If the API call fails for any reason (outage, rate limit, bad key), scoring automatically falls back to the built-in heuristic scorer for that lead, so a run never breaks. Without a key at all, the heuristic scorer is used — it is transparent and rule-based (verified email, completed research, keyword overlap with your brief) and always explains its verdict.

## Lead-search provider setup (Google Places)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or select) a project.
2. Enable the **Places API (New)** — the app uses the `places:searchText` endpoint of the new API, so enabling only the legacy Places API will not work.
3. Create an API key under *APIs & Services → Credentials*. Restrict it to the Places API (New) for safety.
4. In `backend/.env`:

   ```
   LEAD_SEARCH_PROVIDER=google_places
   GOOGLE_PLACES_API_KEY=AIza...
   DEMO_MODE=false
   ```

5. Restart. Engine runs now search real businesses; the query is built from your brief as `<business type or industry> <keywords> in <location>`. Google Places billing applies per request — new Google Cloud accounts include monthly free usage; check current pricing in the console.

## Email verification setup

No key or account is needed. Two modes via `EMAIL_VERIFY_MODE`:

- **`builtin`** (default): real checks with no external service —
  1. **Syntax** — the address must look like a valid email.
  2. **Disposable domains** — known throwaway domains (mailinator.com, yopmail.com, …) are rejected as invalid.
  3. **DNS/MX lookup** (via dnspython) — the domain must publish MX (mail exchanger) records, i.e. actually be able to receive mail. No MX records → `invalid`. Lookup timeout/failure → `risky` (deliverability unconfirmed). Role addresses (`info@`, `sales@`, `support@`, …) with valid MX → `risky`, because they get lower reply rates.

  MX checking confirms the *domain* accepts mail; it cannot confirm an individual *mailbox* exists (that would require SMTP-level probing, which many servers block). Treat `valid` as "safe to try", not a delivery guarantee.

- **`demo`**: simulated results with a realistic mix of valid/risky/invalid — useful offline or behind firewalls that block DNS lookups. Demo mode (`DEMO_MODE=true`) always uses this regardless of the setting.

## Email sender setup (SMTP)

The sender works with **any SMTP provider** — AWS SES, Postmark, Mailgun, Brevo, Google Workspace and others. Generic walkthrough:

1. Pick a provider and verify your sending domain with them (they will give you DNS records — SPF, DKIM — to add; do this, it is essential for deliverability).
2. Get SMTP credentials (host, port, username, password) from the provider's dashboard.
3. In `backend/.env`:

   ```
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_USERNAME=your-smtp-username
   SMTP_PASSWORD=your-smtp-password
   SMTP_FROM_EMAIL=alex@yourdomain.com
   SMTP_FROM_NAME=Alex at Yourco
   DEMO_MODE=false
   ```

4. Restart, then use the Email Builder's **Send test** to confirm delivery to your own inbox before starting any campaign.

The connection uses STARTTLS (plain connection upgraded to TLS), which is what port 587 is for. Leave `SMTP_HOST` empty to keep sends simulated.

### AWS SES specifics

1. In the SES console, **verify your domain** (Verified identities → Create identity → Domain) and add the DKIM records SES gives you to your DNS.
2. Create **SMTP credentials**: SES console → *SMTP settings* → *Create SMTP credentials*. Note these are distinct from your normal AWS access keys.
3. Use the regional SMTP endpoint for the region your identity lives in:

   ```
   SMTP_HOST=email-smtp.<region>.amazonaws.com   # e.g. email-smtp.eu-west-1.amazonaws.com
   SMTP_PORT=587
   ```

4. **Sandbox vs production:** new SES accounts start in the *sandbox*, where you can only send **to** verified addresses and volumes are capped. Campaigns to real leads will fail until you request **production access** (SES console → Account dashboard → Request production access). Do this before going live, and start with low daily limits while your domain reputation warms up.

## Webhook configuration (inbound lead capture)

The webhook endpoint is `POST {PUBLIC_BASE_URL}/api/inbound/lead`. It requires an `X-API-Key` header matching `INBOUND_WEBHOOK_KEY`. Until a key is set, the endpoint returns **503** (not configured); a wrong or missing key returns **403**.

1. Generate a strong key:

   ```bash
   python -c "import secrets; print(secrets.token_hex(24))"
   ```

2. Set it in `backend/.env`:

   ```
   INBOUND_WEBHOOK_KEY=paste-the-generated-value-here
   ```

   (The Settings page can also store a key in the database as a convenience; if both exist, the environment variable wins.)

3. Restart, then test:

   ```bash
   curl -X POST http://localhost:8000/api/inbound/lead \
     -H "Content-Type: application/json" \
     -H "X-API-Key: paste-the-generated-value-here" \
     -d '{"company_name": "Acme Ltd", "contact_name": "Jane Doe", "email": "jane@acme.example.com", "message": "Interested in your services", "source_detail": "Website form"}'
   ```

   A successful call returns `{"ok": true, "lead_id": <id>}`; the lead appears in the workspace flagged `inbound`, and any active automation with the *inbound lead* trigger enrolls it immediately. `GET /api/inbound/status` reports whether the webhook is configured and shows the endpoint URL.

Only `company_name` is required in the payload; `contact_name`, `email`, `website`, `industry`, `location`, `message` and `source_detail` are optional. A ready-made example form is in [examples/inbound-form.html](examples/inbound-form.html).

## Storage

With the default `DATABASE_URL`, all data lives in a single SQLite file at **`backend/nixel_starter.db`** (created automatically on first start, relative to the directory the backend runs from). Back it up by copying the file; delete it to reset the app completely (samples reseed on next start). For production, point `DATABASE_URL` at PostgreSQL — see [installation.md](installation.md).

## Queue / scheduled-task configuration

There is no external queue or cron to configure. A background scheduler inside the backend process ticks every `SCHEDULER_INTERVAL_SECONDS` (default 30 s, minimum 5 s). Each tick:

- **Campaigns:** for every running campaign currently inside its send window, send days and daily limit, the next due sequence email is sent (or simulated) for each enrolled lead, and their next step is scheduled after the step's delay.
- **Automations:** every enrollment whose wait has elapsed executes its next steps until the next wait, a stop condition, or completion.

A shorter interval makes campaigns and automations feel more responsive; the tick is cheap when nothing is due, so the default is fine for most uses. Because the scheduler runs in-process, run exactly one uvicorn worker (details in [installation.md](installation.md)). To trigger campaign processing on demand (e.g. while testing), call `POST /api/campaigns/run-tick`.
