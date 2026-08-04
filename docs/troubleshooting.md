# Troubleshooting

Common errors and how to fix them. When in doubt, look at the backend terminal — the app logs every unhandled error with a stack trace, and 500 responses include the real error message in JSON.

## Backend won't start

**`uvicorn: command not found` / `'uvicorn' is not recognized`** — you are not using the virtual environment. Either run it via the venv path:

- Windows: `.venv\Scripts\uvicorn app.main:app --reload`
- macOS/Linux: `.venv/bin/uvicorn app.main:app --reload`

or activate the venv first (`.venv\Scripts\Activate.ps1` on Windows, `source .venv/bin/activate` on macOS/Linux) and then run `uvicorn app.main:app --reload`. Make sure your terminal is in the `backend` directory — `app.main` is resolved relative to it.

**`ModuleNotFoundError: No module named 'fastapi'` (or `apscheduler`, `dns`, …)** — dependencies aren't installed in the venv you're running from. Fix:

```powershell
.venv\Scripts\pip install -r requirements.txt      # Windows
```
```bash
.venv/bin/pip install -r requirements.txt          # macOS/Linux
```

If it persists, you probably have two venvs or ran `pip` outside the venv — delete `.venv`, recreate it, reinstall.

**PowerShell says running scripts is disabled** (when activating) — either skip activation and use the full `.venv\Scripts\...` paths as above, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## "Failed to fetch" in the UI

The browser could not reach the API, or the browser blocked the response. Check in order:

1. **Is the backend running?** Open http://localhost:8000/api/health — you should see `{"ok": true, ...}`. If not, start the backend.
2. **CORS mismatch.** The backend only allows origins listed in `CORS_ORIGINS` (default `http://localhost:5173`). If your frontend runs on a different port or host (e.g. Vite fell back to 5174 because 5173 was busy, or you're using a LAN IP), add that exact origin: `CORS_ORIGINS=http://localhost:5173,http://localhost:5174` in `backend/.env`, then restart the backend. The origin must match scheme + host + port exactly.
3. **Wrong API URL in the frontend.** The frontend uses `VITE_API_URL` (default `http://localhost:8000`). If you changed the backend port or host, set it in `frontend/.env` (`VITE_API_URL=http://localhost:8000`) and restart `npm run dev` — Vite only reads env vars at startup.

## Port already in use

**Backend:** `[Errno 10048]` / `address already in use` on 8000 — another process (often a previous uvicorn) holds the port. Find and stop it, or run on another port:

- Windows: `netstat -ano | findstr :8000` then `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -i :8000` then `kill <pid>`
- Or: `uvicorn app.main:app --reload --port 8001` (then set `VITE_API_URL=http://localhost:8001` for the frontend).

**Frontend:** Vite automatically picks the next free port (5174, …) — fine locally, but remember to add that origin to `CORS_ORIGINS` (see above).

## Database is locked (SQLite)

`sqlite3.OperationalError: database is locked` means two writers collided — SQLite allows only one writer at a time. This happens if you run **multiple uvicorn workers** (never do this — see [installation.md](installation.md); the in-process scheduler also breaks with >1 worker), run two backend instances against the same file, or hold the file open in a DB browser tool while the app writes. Fix: one uvicorn process with one worker, close external DB tools, and if you genuinely need concurrent load, move to PostgreSQL via `DATABASE_URL` — that is what it's for.

## Emails not sending

Work down this list:

1. **Demo mode is on.** With `DEMO_MODE=true` (the default) *all* sends are simulated by design — they appear in send logs with status `simulated` and the note "Demo mode: email recorded but not sent". Set `DEMO_MODE=false` in `backend/.env` and restart.
2. **SMTP not configured.** Real sending needs at least `SMTP_HOST` and `SMTP_FROM_EMAIL`. Check the Settings page — the email sender should show `SMTP (yourhost)`, not "Demo sender (simulated)".
3. **Credentials/port wrong.** Failed sends are recorded with status `failed` and the actual SMTP error (e.g. `SMTPAuthenticationError`) in the send log — read it. The sender uses STARTTLS, so use your provider's STARTTLS port (`587`), not the implicit-TLS port 465.
4. **AWS SES sandbox.** New SES accounts can only send to verified addresses until you request production access. Symptom: test sends to your own verified inbox work, campaign sends to leads fail with an SES rejection. Request production access in the SES console.
5. **Campaign-level reasons.** Emails only go out when the campaign is `running`, the current time is inside the send window on an allowed send day, the daily limit isn't exhausted, and the member's next send is due. Also note the scheduler only ticks every `SCHEDULER_INTERVAL_SECONDS` (default 30 s) — or force a pass with `POST /api/campaigns/run-tick`.

Use the Email Builder's **Send test** to isolate SMTP problems from campaign scheduling problems.

## MX lookup failures behind firewalls

The built-in email verifier does live DNS MX queries (via dnspython). Corporate firewalls, VPNs and some public networks block outbound DNS, which shows up as many addresses marked `risky` with "MX lookup failed (Timeout); deliverability unconfirmed" — the verifier deliberately treats an *unanswerable* lookup as risky rather than invalid. Options: run from a network that allows DNS, or set `EMAIL_VERIFY_MODE=demo` to simulate verification while offline.

## Webhook returns 503 or 403

- **503 "Inbound webhook is not configured"** — no `INBOUND_WEBHOOK_KEY` is set (in the environment or the Settings page). Generate one and set it, then restart. This is a safety default: the endpoint refuses everything rather than accepting unauthenticated posts.
- **403 "Invalid or missing X-API-Key header"** — a key *is* configured but the request's `X-API-Key` header doesn't match. Check for copy/paste whitespace, that the header name is exactly `X-API-Key`, and remember the environment variable overrides any key saved in Settings — if both exist, the env value is the one that must match.
- A **422** means the key was fine but the JSON body failed validation — `company_name` is required and `email`, if present, must be a valid address.

## Engine run stuck

Runs execute on a background thread and stream events; if the feed stops moving:

- **Check the backend logs first** — if a provider call raised, the run is marked `failed` with the error stored on the run (and shown in the UI). Live-provider runs can also just be slow: real website research fetches several pages per company with multi-second timeouts.
- **Runs are cancellable** — click Cancel in the UI (or `POST /api/engine/runs/{id}/cancel`). The engine checks for cancellation between leads and stops cleanly.
- **"Another run is already in progress" (409)** — only one run may be queued/running at a time. Cancel the active one to start fresh. If the backend was killed mid-run, the old run can be left permanently `running` — cancel it via the same endpoint; a stale row cancels immediately since no thread is actually working it.

## Resetting the database

To wipe everything and start over: stop the backend, delete `backend/nixel_starter.db`, start the backend again. The schema is recreated and, because the database is empty, the sample workspace is **reseeded automatically** on startup. There is no partial reset — export any leads you want to keep as CSV first.

## How onboarding reseed works

Completing (or re-running) onboarding calls `POST /api/settings/onboarding`, which saves your business profile and then **rebuilds the sample data around your industry and location**: all rows flagged `is_sample=true` (sample leads, the sample run and its events, sample templates, campaign, automation and opportunities) are deleted and recreated with your market's names. Your own data — anything you created or edited (editing a sample clears its flag) — is untouched. If sample content seems to have "changed" after onboarding, that is this reseed working as intended.
