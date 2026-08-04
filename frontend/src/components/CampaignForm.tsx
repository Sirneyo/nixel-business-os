import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Campaign, EmailTemplate } from "../types";
import { Button, FormField, Input, Select } from "./ui";

export interface CampaignFormValue {
  name: string;
  sender_name: string;
  sender_email: string;
  daily_limit: number;
  send_window_start: string;
  send_window_end: string;
  send_days: string;
  steps: { template_id: number; delay_days: number }[];
}

export function emptyCampaignForm(): CampaignFormValue {
  return {
    name: "",
    sender_name: "",
    sender_email: "",
    daily_limit: 50,
    send_window_start: "09:00",
    send_window_end: "17:00",
    send_days: "1,2,3,4,5",
    steps: [],
  };
}

export function campaignToForm(campaign: Campaign): CampaignFormValue {
  return {
    name: campaign.name,
    sender_name: campaign.sender_name,
    sender_email: campaign.sender_email,
    daily_limit: campaign.daily_limit,
    send_window_start: campaign.send_window_start,
    send_window_end: campaign.send_window_end,
    send_days: campaign.send_days,
    steps: campaign.steps.map((s) => ({ template_id: s.template_id, delay_days: s.delay_days })),
  };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CampaignForm({
  templates,
  initial,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  templates: EmailTemplate[];
  initial: CampaignFormValue;
  saving: boolean;
  submitLabel: string;
  onSubmit: (value: CampaignFormValue) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CampaignFormValue>(initial);

  function set<K extends keyof CampaignFormValue>(key: K, value: CampaignFormValue[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const days = new Set(form.send_days.split(",").filter(Boolean));

  function toggleDay(day: number) {
    const key = String(day);
    const next = new Set(days);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    set("send_days", [...next].sort().join(","));
  }

  function addStep() {
    if (templates.length === 0) return;
    set("steps", [...form.steps, { template_id: templates[0].id, delay_days: form.steps.length === 0 ? 0 : 3 }]);
  }

  function updateStep(index: number, patch: Partial<{ template_id: number; delay_days: number }>) {
    set(
      "steps",
      form.steps.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  return (
    <div className="space-y-4">
      <FormField label="Campaign name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Manchester dentists — spring outreach" autoFocus />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Sender name" hint="Used as {{sender_name}} in templates.">
          <Input value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} placeholder="Alex" />
        </FormField>
        <FormField label="Sender email" hint="Must match your configured SMTP sender for real sending.">
          <Input value={form.sender_email} onChange={(e) => set("sender_email", e.target.value)} placeholder="alex@yourdomain.com" />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormField label="Daily limit">
          <Input type="number" min={1} max={2000} value={form.daily_limit} onChange={(e) => set("daily_limit", Number(e.target.value) || 1)} />
        </FormField>
        <FormField label="Window start">
          <Input type="time" value={form.send_window_start} onChange={(e) => set("send_window_start", e.target.value)} />
        </FormField>
        <FormField label="Window end">
          <Input type="time" value={form.send_window_end} onChange={(e) => set("send_window_end", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Sending days">
        <div className="flex gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const day = i + 1;
            const active = days.has(String(day));
            return (
              <button
                key={label}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500 hover:bg-ink-200"
                }`}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </FormField>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Email sequence</span>
          <Button size="sm" variant="secondary" type="button" onClick={addStep} disabled={templates.length === 0}>
            <Plus size={13} /> Add step
          </Button>
        </div>
        {templates.length === 0 && <p className="text-sm text-ink-400">Create an email template first (Email Builder), then add steps here.</p>}
        <div className="space-y-2">
          {form.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 p-2.5">
              <span className="w-14 shrink-0 text-center text-xs font-bold text-ink-400">Step {index + 1}</span>
              <Select className="flex-1" value={step.template_id} onChange={(e) => updateStep(index, { template_id: Number(e.target.value) })}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {index > 0 && (
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-ink-500">
                  after
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    className="!w-16"
                    value={step.delay_days}
                    onChange={(e) => updateStep(index, { delay_days: Number(e.target.value) || 0 })}
                  />
                  days
                </div>
              )}
              <button type="button" className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600" onClick={() => set("steps", form.steps.filter((_, i) => i !== index))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" loading={saving} disabled={form.name.trim().length < 2} onClick={() => onSubmit(form)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
