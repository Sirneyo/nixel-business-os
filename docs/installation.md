# Installation

This guide covers running Nixel Business OS — Starter Edition locally (Windows and macOS/Linux) and a production installation path.

## Prerequisites

- **Python 3.11 or newer** — check with `python --version` (Windows) or `python3 --version` (macOS/Linux)
- **Node.js 18 or newer** — check with `node --version`
- Git (to clone and update)

## Local installation — Windows (PowerShell)

1. Open PowerShell in the project folder.
2. Create the backend virtual environment and install dependencies:

   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\pip install -r requirements.txt
   ```

3. Start the backend:

   ```powershell
   .venv\Scripts\uvicorn app.main:app --reload
   ```

   The API is now at http://localhost:8000 (interactive docs at http://localhost:8000/docs). On first start the SQLite database file `backend/nixel_starter.db` is created automatically and a labelled sample workspace is seeded.

4. In a **second** PowerShell window, start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open **http://localhost:5173** in your browser.

## Local installation — macOS / Linux

1. Open a terminal in the project folder.
2. Backend:

   ```bash
   cd backend
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   .venv/bin/uvicorn app.main:app --reload
   ```

3. In a second terminal, frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open **http://localhost:5173**.

## First run: onboarding

The first time you open the app it walks you through a short onboarding — your business name, industry, target audience, location and primary offer. Completing it does two things: it stores your business profile (used by email merge fields like `{{business_name}}` and `{{primary_offer}}`), and it **rebuilds the sample workspace around your own market**, so the sample leads, campaign and pipeline all look like your world. Everything seeded is labelled "Sample" and can be deleted or replaced at any time.

No `.env` file is needed for any of this — the app runs fully in Demo Mode by default. To connect real providers later, copy `backend/.env.example` to `backend/.env`, fill in your keys, set `DEMO_MODE=false` and restart the backend. See [configuration.md](configuration.md).

---

# Production installation

> Read [security-checklist.md](security-checklist.md) **before** exposing this system to the internet. The Starter Edition ships with no user authentication.

## 1. Use PostgreSQL

SQLite is perfect for local use, but for production switch to PostgreSQL via `DATABASE_URL` in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://nixel:YOUR_PASSWORD@localhost:5432/nixel_starter
```

Install the driver in the backend venv: `pip install "psycopg[binary]"`. Tables are created automatically on first start. Note that the built-in schema helper only *adds* missing columns — for a long-lived production database, adopt a real migration tool (e.g. Alembic) once you start customising models.

## 2. Run uvicorn behind a reverse proxy

Run the backend bound to localhost, without `--reload`:

```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Example nginx site config (API + built frontend):

```nginx
server {
    server_name yourdomain.com;

    # Built frontend (static files)
    root /var/www/nixel/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Update `backend/.env` to match your domain:

```
PUBLIC_BASE_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

## 3. Build and serve the frontend

```bash
cd frontend
VITE_API_URL=https://yourdomain.com npm run build
```

(On Windows PowerShell: `$env:VITE_API_URL = "https://yourdomain.com"; npm run build`.)

This produces a static `frontend/dist/` folder. Serve it with nginx/Caddy as above — no Node process is needed in production.

## 4. Run the backend as a service

**Linux (systemd)** — create `/etc/systemd/system/nixel.service`:

```ini
[Unit]
Description=Nixel Business OS Starter backend
After=network.target postgresql.service

[Service]
User=nixel
WorkingDirectory=/var/www/nixel/backend
ExecStart=/var/www/nixel/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nixel
sudo systemctl status nixel
```

**Windows server** — use [NSSM](https://nssm.cc/) (the Non-Sucking Service Manager) to wrap uvicorn as a Windows service: `nssm install NixelBackend "C:\path\to\backend\.venv\Scripts\uvicorn.exe" "app.main:app --host 127.0.0.1 --port 8000"`, set the startup directory to the `backend` folder, then `nssm start NixelBackend`.

## 5. Keeping the scheduler running (important)

The background scheduler — the tick that sends campaign emails and advances automations every `SCHEDULER_INTERVAL_SECONDS` — runs **inside the uvicorn process**. Two rules follow:

- **Run exactly one uvicorn worker.** Do **not** use `--workers 2` (or more) with the in-process scheduler: each worker would start its own scheduler and campaign emails could be processed multiple times per tick. The default single-process command above is correct.
- If the backend process is down, no emails send and no automations advance. Running it as a service with `Restart=always` (or NSSM's restart behaviour) keeps it alive.

If you later need multiple API workers for load, move the tick out of the web process (e.g. disable the in-process scheduler and call the tick from one dedicated process or cron) — until then, one worker is the simple, correct setup.

## 6. Connect a domain and enable HTTPS

1. At your DNS provider, create an **A record** pointing your domain (e.g. `app.yourdomain.com`) at the server's public IP. Allow time for DNS to propagate.
2. Enable HTTPS:
   - **nginx + certbot:** `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d yourdomain.com` — certbot edits the nginx config and auto-renews.
   - **Caddy** (alternative to nginx): HTTPS is automatic. A complete Caddyfile (note the use of `handle`, not `handle_path` — backend routes include the `/api` prefix, so it must not be stripped):

     ```
     yourdomain.com {
         handle /api/* {
             reverse_proxy 127.0.0.1:8000
         }
         handle {
             root * /var/www/nixel/frontend/dist
             try_files {path} /index.html
             file_server
         }
     }
     ```
3. After HTTPS is live, confirm `PUBLIC_BASE_URL` and `CORS_ORIGINS` use `https://`.

## 7. Updating the application

```bash
cd /var/www/nixel
git pull
cd backend && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install && VITE_API_URL=https://yourdomain.com npm run build
sudo systemctl restart nixel
```

Take a database backup **before** every update (next section). Schema additions are applied automatically on restart; anything more than additive changes needs a migration you review first.

## 8. Backups

- **SQLite:** the whole database is one file — `backend/nixel_starter.db`. Copy it nightly and before every update, while the backend is stopped or quiet:

  ```bash
  cp backend/nixel_starter.db /backups/nixel_starter-$(date +%F).db
  ```

- **PostgreSQL:** use `pg_dump` nightly (cron) and before updates:

  ```bash
  pg_dump -U nixel -d nixel_starter -F c -f /backups/nixel_starter-$(date +%F).dump
  ```

Keep backups on a different machine or storage bucket, and test a restore at least once — a backup you have never restored is a hope, not a backup.
