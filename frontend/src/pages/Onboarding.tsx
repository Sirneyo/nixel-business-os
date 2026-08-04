import { ArrowRight, Blocks, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { completeOnboarding, fetchHealth } from "../api/client";
import { Button, ErrorNote, FormField, Input, Select } from "../components/ui";

const STEPS = ["Your business", "Your market", "Your tools", "Ready"];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [form, setForm] = useState({
    business_name: "",
    industry: "",
    target_audience: "",
    target_location: "",
    primary_offer: "",
    email_provider: "",
    ai_provider: "",
  });

  useEffect(() => {
    fetchHealth().then((h) => setDisclaimer(h.disclaimer)).catch(() => undefined);
  }, []);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding(form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const canNext =
    step === 0 ? form.business_name.trim().length > 1 : step === 1 ? form.industry.trim().length > 0 : true;

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-gradient-to-br from-ink-50 via-white to-brand-50 p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <Blocks size={24} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">Nixel Business OS</h1>
            <p className="text-sm font-medium text-ink-500">Starter Edition setup</p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500" : "bg-ink-100 text-ink-400"
                }`}
              >
                {i < step ? <CheckCircle2 size={15} /> : i + 1}
              </div>
              <span className={`hidden text-xs font-semibold sm:block ${i === step ? "text-ink-800" : "text-ink-400"}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-brand-400" : "bg-ink-200"}`} />}
            </div>
          ))}
        </div>

        <div className="animate-fade-up rounded-2xl border border-ink-200/70 bg-white p-7 shadow-pop">
          <ErrorNote message={error} />

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-ink-900">Tell us about your business</h2>
              <FormField label="Business name">
                <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="e.g. Atlas Consulting" autoFocus />
              </FormField>
              <FormField label="Industry">
                <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Marketing, Recruitment, Landscaping" />
              </FormField>
              <FormField label="Primary offer" hint="Used in your sample email templates as {{primary_offer}}.">
                <Input value={form.primary_offer} onChange={(e) => set("primary_offer", e.target.value)} placeholder="e.g. done-for-you social media management" />
              </FormField>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-ink-900">Who are you targeting?</h2>
              <FormField label="Target audience" hint="The engine uses this brief when assessing lead relevance.">
                <Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)} placeholder="e.g. independent dental practices with 2–10 staff" autoFocus />
              </FormField>
              <FormField label="Target location">
                <Input value={form.target_location} onChange={(e) => set("target_location", e.target.value)} placeholder="e.g. Manchester, UK" />
              </FormField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-ink-900">Your preferred tools</h2>
              <p className="text-sm text-ink-500">
                Nothing to connect yet — this just records your preferences. Actual credentials go in the backend{" "}
                <code className="rounded bg-ink-100 px-1 text-xs">.env</code> file (see Settings for status).
              </p>
              <FormField label="Preferred email provider">
                <Select value={form.email_provider} onChange={(e) => set("email_provider", e.target.value)}>
                  <option value="">Choose later</option>
                  <option>AWS SES</option>
                  <option>Postmark</option>
                  <option>Mailgun</option>
                  <option>SendGrid</option>
                  <option>Google Workspace</option>
                  <option>Other SMTP</option>
                </Select>
              </FormField>
              <FormField label="Preferred AI provider">
                <Select value={form.ai_provider} onChange={(e) => set("ai_provider", e.target.value)}>
                  <option value="">Choose later</option>
                  <option>Anthropic (Claude)</option>
                  <option>Built-in heuristic only</option>
                </Select>
              </FormField>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-ink-900">You're ready to go</h2>
              <p className="text-sm leading-relaxed text-ink-600">
                We'll prepare a sample workspace tailored to <strong>{form.industry || "your industry"}</strong>
                {form.target_location ? ` around ${form.target_location}` : ""} so you can explore every module straight away.
                Sample data is clearly labelled and disappears as you replace it with real work.
              </p>
              {disclaimer && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-warn-500/30 bg-warn-50 p-3 text-xs leading-relaxed text-warn-700">
                  <strong className="mb-1 block">Please read before using real data:</strong>
                  {disclaimer}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight size={15} />
              </Button>
            ) : (
              <Button loading={saving} onClick={finish}>
                I understand — build my workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
