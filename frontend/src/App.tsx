import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { fetchHealth, fetchOnboardingStatus } from "./api/client";
import Sidebar from "./components/Sidebar";
import Automations from "./pages/Automations";
import CampaignDetail from "./pages/CampaignDetail";
import Campaigns from "./pages/Campaigns";
import Dashboard from "./pages/Dashboard";
import EmailBuilder from "./pages/EmailBuilder";
import Inbound from "./pages/Inbound";
import LeadEngine from "./pages/LeadEngine";
import Leads from "./pages/Leads";
import Onboarding from "./pages/Onboarding";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/Settings";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    Promise.all([fetchOnboardingStatus(), fetchHealth()])
      .then(([onboarding, health]) => {
        setOnboarded(onboarding.completed);
        setDemoMode(health.demo_mode);
      })
      .catch(() => setBackendDown(true))
      .finally(() => setReady(true));
  }, []);

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

  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar demoMode={demoMode} />
      <main className="relative flex-1 overflow-hidden">
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
      </main>
    </div>
  );
}
