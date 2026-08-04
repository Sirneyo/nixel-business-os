import { Bot, CheckCircle2, KeyRound, Mail, Search, Settings as SettingsIcon, Webhook, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchSettings, updateSettings } from "../api/client";
import { Badge, Button, Card, ErrorNote, FormField, Input, PageContainer, PageHeader, Spinner } from "../components/ui";
import type { AppSettings } from "../types";

const PROFILE_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "profile.business_name", label: "Business name", hint: "Used as {{business_name}} in emails." },
  { key: "profile.industry", label: "Industry" },
  { key: "profile.target_audience", label: "Target audience", hint: "Default brief for lead relevance assessment." },
  { key: "profile.target_location", label: "Target location" },
  { key: "profile.primary_offer", label: "Primary offer", hint: "Used as {{primary_offer}} in emails." },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setValues(s.values);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(values);
      setNotice("Settings saved.");
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Your business profile lives here. Provider credentials (API keys, SMTP) are configured in the backend .env file — their status is shown below, but secrets are never displayed or stored in the database."
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}
      {!settings && !error && <Spinner />}

      {settings && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">Business profile</h2>
            <div className="space-y-3.5">
              {PROFILE_FIELDS.map((field) => (
                <FormField key={field.key} label={field.label} hint={field.hint}>
                  <Input value={values[field.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} />
                </FormField>
              ))}
              <FormField
                label="Inbound webhook key (override)"
                hint="Prefer setting INBOUND_WEBHOOK_KEY in the backend .env. This database override exists for quick local testing only."
              >
                <Input value={values["inbound_webhook_key"] ?? ""} onChange={(e) => setValues((v) => ({ ...v, inbound_webhook_key: e.target.value }))} placeholder="Leave blank to use the .env value" />
              </FormField>
              <Button loading={saving} onClick={save}>Save settings</Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-1 font-display text-base font-bold text-ink-900">Connected providers</h2>
              <p className="mb-4 text-sm text-ink-500">
                Configured via <code className="rounded bg-ink-100 px-1 text-xs">backend/.env</code> — see{" "}
                <code className="rounded bg-ink-100 px-1 text-xs">docs/configuration.md</code> for every option. Restart the backend after changes.
              </p>
              <ul className="space-y-2.5">
                <ProviderRow icon={Bot} label="AI lead scoring" status={settings.providers.ai} />
                <ProviderRow icon={Search} label="Lead search" status={settings.providers.lead_search} />
                <ProviderRow icon={CheckCircle2} label="Email verification" status={settings.providers.email_verify} />
                <ProviderRow icon={Mail} label="Email sending" status={settings.providers.email_sender} />
                <ProviderRow icon={Webhook} label="Inbound webhook" status={{ configured: settings.providers.inbound_webhook.configured, name: settings.providers.inbound_webhook.configured ? "Key set" : "No key set" }} />
              </ul>
            </Card>

            {settings.providers.demo_mode && (
              <Card className="border-warn-500/30 bg-warn-50 p-5">
                <div className="flex items-start gap-3">
                  <KeyRound size={18} className="mt-0.5 shrink-0 text-warn-600" />
                  <div className="text-sm leading-relaxed text-warn-700">
                    <strong>Demo Mode is on</strong> (<code className="text-xs">DEMO_MODE=true</code>). Search, research, verification, scoring and
                    email sending are all simulated so you can explore safely. Set <code className="text-xs">DEMO_MODE=false</code> and add real
                    provider credentials when you're ready — the security checklist in{" "}
                    <code className="text-xs">docs/security-checklist.md</code> comes first.
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function ProviderRow({ icon: Icon, label, status }: { icon: typeof Bot; label: string; status: { configured: boolean; name?: string } }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
        <Icon size={16} className="text-ink-400" /> {label}
      </span>
      <span className="flex items-center gap-2">
        {status.name && <span className="text-xs text-ink-400">{status.name}</span>}
        {status.configured ? (
          <Badge tone="green"><CheckCircle2 size={11} /> Ready</Badge>
        ) : (
          <Badge tone="gray"><XCircle size={11} /> Demo / not set</Badge>
        )}
      </span>
    </li>
  );
}
