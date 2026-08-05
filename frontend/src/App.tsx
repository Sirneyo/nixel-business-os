import { Menu } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { fetchAuthStatus, fetchHealth, fetchSettings, getToken, logout, setToken } from "./api/client";
import Sidebar from "./components/Sidebar";
import Automations from "./pages/Automations";
import CampaignDetail from "./pages/CampaignDetail";
import Campaigns from "./pages/Campaigns";
import Dashboard from "./pages/Dashboard";
import EmailBuilder from "./pages/EmailBuilder";
import Inbound from "./pages/Inbound";
import LeadEngine from "./pages/LeadEngine";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/Settings";
import type { AppSettings } from "./types";

export default function App() {
  const [ready, setReady] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    const status = await fetchAuthStatus();
    setAccountExists(status.account_exists);
    setOnboarded(status.onboarded);
    return status;
  }, []);

  useEffect(() => {
    Promise.all([fetchHealth(), refreshStatus()])
      .then(() => setAuthed(Boolean(getToken())))
      .catch(() => setBackendDown(true))
      .finally(() => setReady(true));
  }, [refreshStatus]);

  // The API client fires this when any request comes back 401.
  useEffect(() => {
    const onUnauthorized = () => {
      setAuthed(false);
      setSettings(null);
    };
    window.addEventListener("nixel:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nixel:unauthorized", onUnauthorized);
  }, []);

  const businessName = settings?.values["profile.business_name"]?.trim() || "";

  useEffect(() => {
    if (!authed) return;
    fetchSettings().then(setSettings).catch(() => undefined);
  }, [authed, onboarded]);

  useEffect(() => {
    document.title = businessName ? `${businessName} — powered by Nixel` : "Nixel Business OS";
  }, [businessName]);

  if (!ready) return null;

  if (backendDown) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-50 p-6">
        <div className="max-w-md rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-card">
          <h1 className="font-display text-xl font-bold text-ink-900">Backend not reachable</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Start the API first: open a terminal in <code className="rounded bg-ink-100 px-1">backend/</code> and run{" "}
            <code className="rounded bg-ink-100 px-1">.venv\Scripts\uvicorn app.main:app --reload</code>, then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  if (!accountExists || (authed && !onboarded)) {
    return (
      <Onboarding
        needsAccount={!accountExists}
        onDone={() => {
          setAccountExists(true);
          setOnboarded(true);
          setAuthed(true);
        }}
      />
    );
  }

  if (!authed) {
    return (
      <Login
        onLogin={() => {
          setAuthed(true);
          refreshStatus().catch(() => undefined);
        }}
      />
    );
  }

  async function handleLogout() {
    await logout().catch(() => setToken(null));
    setAuthed(false);
    setSettings(null);
  }

  return (
    <div className="flex h-full">
      <Sidebar
        businessName={businessName}
        settings={settings}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-ink-200/70 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-50"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <p className="truncate font-display text-sm font-extrabold tracking-tight text-ink-900">
            {businessName || "Nixel Business OS"}
          </p>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/engine" element={<LeadEngine />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/inbound" element={<Inbound />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/emails" element={<EmailBuilder />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
