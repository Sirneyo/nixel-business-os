import { Bot, CheckCircle2, Mail, Plug, Search, Settings as SettingsIcon, Webhook, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchSettings, updateSettings } from "../api/client";
import { Badge, Button, Card, ErrorNote, FormField, Input, PageContainer, PageHeader, Spinner } from "../components/ui";
import type { AppSettings } from "../types";

const PROFILE_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "profile.business_name", label: "Business name", hint: "Shown as the app name and used as {{business_name}} in emails." },
  { key: "profile.industry", label: "Industry" },
  { key: "profile.target_audience", label: "Target audience", hint: "Default brief for lead relevance assessment." },
  { key: "profile.target_location", label: "Target location" },
  { key: "profile.primary_offer", label: "Primary offer", hint: "Used as {{primary_offer}} in emails." },
];

const CONNECTION_GROUPS: {
  title: string;
  description: string;
  fields: { key: string; label: string; hint?: string; secret?: boolean }[];
}[] = [
  {
    title: "Lead search — Google Places",
    description: "Finds real businesses that match your search brief. Create a key in Google Cloud Console with the Places API enabled.",
    fields: [{ key: "google_places_api_key", label: "Google Places API key", secret: true }],
  },
  {
    title: "AI lead scoring — Claude",
    description: "Upgrades lead scoring from the built-in rules to AI judgement. Get a key from console.anthropic.com.",
    fields: [{ key: "anthropic_api_key", label: "Claude (Anthropic) API key", secret: true }],
  },
  {
    title: "Email sending — SMTP",
    description: "Works with any SMTP provider: AWS SES, Postmark, Mailgun, SendGrid, Google Workspace and others. Your provider's dashboard shows these values.",
    fields: [
      { key: "smtp_host", label: "SMTP host", hint: "e.g. smtp.eu.mailgun.org" },
      { key: "smtp_port", label: "SMTP port", hint: "Usually 587." },
      { key: "smtp_username", label: "SMTP username" },
      { key: "smtp_password", label: "SMTP password", secret: true },
      { key: "smtp_from_email", label: "From email", hint: "The address your emails are sent from — must be verified with your provider." },
      { key: "smtp_from_name", label: "From name", hint: "e.g. Sarah at Atlas Consulting" },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return fetchSettings()
      .then((s) => {
        setSettings(s);
        setValues(s.values);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Only credentials the user actually typed are sent; the rest stay untouched.
      const dirtySecrets = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim() !== ""));
      await updateSettings(values, dirtySecrets);
      setSecrets({});
      await load();
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
        subtitle="Your business profile and service connections live here. Credentials are stored only in your own local database and are never shown again once saved."
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}
      {!settings && !error && <Spinner />}

      {settings && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-4 font-display text-base font-bold text-ink-900">Business profile</h2>
              <div className="space-y-3.5">
                {PROFILE_FIELDS.map((field) => (
                  <FormField key={field.key} label={field.label} hint={field.hint}>
                    <Input value={values[field.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} />
                  </FormField>
                ))}
                <FormField
                  label="Inbound webhook key"
                  hint="Protects the inbound lead endpoint your website forms post to. Use a long random value."
                >
                  <Input value={values["inbound_webhook_key"] ?? ""} onChange={(e) => setValues((v) => ({ ...v, inbound_webhook_key: e.target.value }))} placeholder="Leave blank to use the .env value" />
                </FormField>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 font-display text-base font-bold text-ink-900">Connection status</h2>
              <p className="mb-4 text-sm text-ink-500">Each capability switches on automatically the moment its connection is saved.</p>
              <ul className="space-y-2.5">
                <ProviderRow icon={Search} label="Lead search" status={settings.providers.lead_search} />
                <ProviderRow icon={Bot} label="AI lead scoring" status={settings.providers.ai} />
                <ProviderRow icon={CheckCircle2} label="Email verification" status={settings.providers.email_verify} />
                <ProviderRow icon={Mail} label="Email sending" status={settings.providers.email_sender} />
                <ProviderRow icon={Webhook} label="Inbound webhook" status={{ configured: settings.providers.inbound_webhook.configured, name: settings.providers.inbound_webhook.configured ? "Key set" : "No key set" }} />
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <Plug size={16} className="text-brand-600" />
              <h2 className="font-display text-base font-bold text-ink-900">Connections</h2>
            </div>
            <p className="mb-5 text-sm text-ink-500">
              Paste your service keys here. Saved credentials are never displayed again — type a new value to replace one.
            </p>
            <div className="space-y-6">
              {CONNECTION_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-bold text-ink-800">{group.title}</h3>
                  <p className="mb-3 mt-0.5 text-xs leading-relaxed text-ink-400">{group.description}</p>
                  <div className="space-y-3">
                    {group.fields.map((field) => {
                      const configured = settings.secrets_configured?.[field.key];
                      return (
                        <FormField key={field.key} label={field.label} hint={field.hint}>
                          <Input
                            type={field.secret ? "password" : "text"}
                            autoComplete="off"
                            value={secrets[field.key] ?? ""}
                            onChange={(e) => setSecrets((s) => ({ ...s, [field.key]: e.target.value }))}
                            placeholder={configured ? "Configured — type to replace" : ""}
                          />
                        </FormField>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Button loading={saving} onClick={save}>Save settings</Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function ProviderRow({ icon: Icon, label, status }: { icon: typeof Bot; label: string; status: { configured: boolean; name?: string } }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 px-3.5 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
        <Icon size={16} className="shrink-0 text-ink-400" /> {label}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {status.name && <span className="truncate text-xs text-ink-400">{status.name}</span>}
        {status.configured ? (
          <Badge tone="green"><CheckCircle2 size={11} /> Ready</Badge>
        ) : (
          <Badge tone="amber"><XCircle size={11} /> Not connected</Badge>
        )}
      </span>
    </li>
  );
}
