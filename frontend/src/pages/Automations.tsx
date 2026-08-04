import { FlaskConical, Pause, Pencil, Play, Plus, ScrollText, Trash2, Workflow } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  activateAutomation,
  createAutomation,
  deleteAutomation,
  fetchAutomationLogs,
  fetchAutomationOptions,
  fetchAutomations,
  fetchCampaigns,
  fetchTemplates,
  pauseAutomation,
  testRunAutomation,
  updateAutomation,
} from "../api/client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  FormField,
  Input,
  Modal,
  PageContainer,
  PageHeader,
  SampleBadge,
  Select,
  Spinner,
} from "../components/ui";
import { formatDate, titleCase } from "../lib/format";
import type { Automation, AutomationLogEntry, AutomationOptions, Campaign, EmailTemplate } from "../types";

interface StepDraft {
  kind: string;
  config: Record<string, unknown>;
}

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [options, setOptions] = useState<AutomationOptions | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const [logsFor, setLogsFor] = useState<Automation | null>(null);

  const load = useCallback(() => {
    fetchAutomations().then(setAutomations).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
    fetchAutomationOptions().then(setOptions).catch(() => undefined);
    fetchTemplates().then(setTemplates).catch(() => undefined);
    fetchCampaigns().then(setCampaigns).catch(() => undefined);
  }, [load]);

  async function act(action: () => Promise<unknown>, message?: string) {
    setError(null);
    try {
      await action();
      if (message) {
        setNotice(message);
        setTimeout(() => setNotice(null), 4000);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  function describeStep(kind: string, config: Record<string, unknown>): string {
    switch (kind) {
      case "send_email":
        return `Send "${templates.find((t) => t.id === Number(config.template_id))?.name ?? `template #${config.template_id}`}"`;
      case "add_to_campaign":
        return `Add to "${campaigns.find((c) => c.id === Number(config.campaign_id))?.name ?? `campaign #${config.campaign_id}`}"`;
      case "wait":
        return `Wait ${config.days ?? 0} day(s)`;
      case "check_replied":
        return "Check response status (stop if replied)";
      case "create_opportunity":
        return "Create pipeline opportunity";
      case "add_note":
        return "Add a note to the lead";
      default:
        return kind;
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Workflow}
        title="Automations"
        subtitle="Simple trigger → step flows: when a lead qualifies, arrives inbound or is approved, the system emails, waits, checks for replies and creates opportunities for you. Simulation mode logs every action without doing anything external."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={15} /> New automation
          </Button>
        }
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}

      {automations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No automations yet"
          hint='Example: Lead verified → Add to campaign → Wait 3 days → Check response → Send follow-up → Create pipeline opportunity.'
          action={<Button onClick={() => setEditing("new")}>Create your first automation</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {automations.map((automation) => (
            <Card key={automation.id} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink-900">
                    {automation.name} <SampleBadge show={automation.is_sample} />
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Trigger: {options?.triggers.find((t) => t.key === automation.trigger)?.label ?? automation.trigger}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {automation.simulation_mode && <Badge tone="violet">Simulation</Badge>}
                  <Badge tone={automation.status === "active" ? "green" : "amber"}>{titleCase(automation.status)}</Badge>
                </div>
              </div>

              <ol className="mb-4 space-y-1.5">
                {automation.steps.map((step, i) => (
                  <li key={step.id} className="flex items-center gap-2.5 text-sm text-ink-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-500">{i + 1}</span>
                    {describeStep(step.kind, step.config)}
                  </li>
                ))}
                {automation.steps.length === 0 && <p className="text-sm text-ink-400">No steps yet.</p>}
              </ol>

              <div className="mb-4 flex gap-3 text-xs text-ink-500">
                <span><strong className="text-ink-800">{automation.stats.active ?? 0}</strong> active</span>
                <span><strong className="text-ink-800">{automation.stats.completed ?? 0}</strong> completed</span>
                <span><strong className="text-ink-800">{automation.stats.stopped ?? 0}</strong> stopped</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {automation.status === "active" ? (
                  <Button size="sm" variant="secondary" onClick={() => act(() => pauseAutomation(automation.id), "Automation paused.")}>
                    <Pause size={13} /> Pause
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => act(() => activateAutomation(automation.id), "Automation active — it now reacts to its trigger.")}>
                    <Play size={13} /> Activate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    act(async () => {
                      const r = await testRunAutomation(automation.id);
                      setNotice(`Test run complete using "${r.tested_with}" — see the activity log.`);
                    })
                  }
                >
                  <FlaskConical size={13} /> Test run
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setLogsFor(automation)}>
                  <ScrollText size={13} /> Activity
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(automation)}>
                  <Pencil size={13} /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-danger-600"
                  onClick={() => {
                    if (window.confirm("Delete this automation and its history?")) act(() => deleteAutomation(automation.id));
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && options && (
        <AutomationEditor
          automation={editing === "new" ? null : editing}
          options={options}
          templates={templates}
          campaigns={campaigns}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {logsFor && <LogsModal automation={logsFor} onClose={() => setLogsFor(null)} />}
    </PageContainer>
  );
}

function AutomationEditor({
  automation,
  options,
  templates,
  campaigns,
  onClose,
  onSaved,
}: {
  automation: Automation | null;
  options: AutomationOptions;
  templates: EmailTemplate[];
  campaigns: Campaign[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(automation?.name ?? "");
  const [trigger, setTrigger] = useState(automation?.trigger ?? "lead_qualified");
  const [simulation, setSimulation] = useState(automation?.simulation_mode ?? true);
  const [steps, setSteps] = useState<StepDraft[]>(automation?.steps.map((s) => ({ kind: s.kind, config: s.config })) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function defaultConfig(kind: string): Record<string, unknown> {
    switch (kind) {
      case "send_email":
        return { template_id: templates[0]?.id ?? 0 };
      case "add_to_campaign":
        return { campaign_id: campaigns[0]?.id ?? 0 };
      case "wait":
        return { days: 3 };
      case "create_opportunity":
        return { stage: "new_lead" };
      case "add_note":
        return { text: "" };
      default:
        return {};
    }
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { name, trigger, simulation_mode: simulation, steps };
    try {
      if (automation) await updateAutomation(automation.id, payload);
      else await createAutomation(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal title={automation ? "Edit automation" : "New automation"} onClose={onClose} wide>
      <ErrorNote message={error} />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Qualified lead follow-up" autoFocus />
          </FormField>
          <FormField label="Trigger">
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {options.triggers.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-accent-500/30 bg-accent-50 px-4 py-3 text-sm text-ink-700">
          <input type="checkbox" checked={simulation} onChange={(e) => setSimulation(e.target.checked)} />
          <span>
            <strong>Simulation mode</strong> — log every action without sending emails or changing campaigns. Turn off when you're confident.
          </span>
        </label>

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-500">Steps (run in order)</span>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 p-2.5">
                <span className="w-8 text-center text-xs font-bold text-ink-400">{index + 1}</span>
                <Select
                  className="!w-56"
                  value={step.kind}
                  onChange={(e) => updateStep(index, { kind: e.target.value, config: defaultConfig(e.target.value) })}
                >
                  {options.step_kinds.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </Select>

                {step.kind === "send_email" && (
                  <Select className="!w-52" value={Number(step.config.template_id ?? 0)} onChange={(e) => updateStep(index, { config: { template_id: Number(e.target.value) } })}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                )}
                {step.kind === "add_to_campaign" && (
                  <Select className="!w-52" value={Number(step.config.campaign_id ?? 0)} onChange={(e) => updateStep(index, { config: { campaign_id: Number(e.target.value) } })}>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                )}
                {step.kind === "wait" && (
                  <span className="flex items-center gap-1.5 text-sm text-ink-500">
                    <Input type="number" min={0} max={90} className="!w-16" value={Number(step.config.days ?? 0)} onChange={(e) => updateStep(index, { config: { days: Number(e.target.value) || 0 } })} />
                    days
                  </span>
                )}
                {step.kind === "create_opportunity" && (
                  <Select className="!w-44" value={String(step.config.stage ?? "new_lead")} onChange={(e) => updateStep(index, { config: { stage: e.target.value } })}>
                    {["new_lead", "contacted", "replied", "qualified"].map((s) => (
                      <option key={s} value={s}>{titleCase(s)}</option>
                    ))}
                  </Select>
                )}
                {step.kind === "add_note" && (
                  <Input className="!w-64" value={String(step.config.text ?? "")} onChange={(e) => updateStep(index, { config: { text: e.target.value } })} placeholder="Note text…" />
                )}

                <button className="ml-auto rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600" onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setSteps((prev) => [...prev, { kind: "wait", config: { days: 3 } }])}>
            <Plus size={13} /> Add step
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={name.trim().length < 2} onClick={save}>
            {automation ? "Save changes" : "Create automation"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LogsModal({ automation, onClose }: { automation: Automation; onClose: () => void }) {
  const [logs, setLogs] = useState<AutomationLogEntry[] | null>(null);

  useEffect(() => {
    fetchAutomationLogs(automation.id).then(setLogs).catch(() => setLogs([]));
  }, [automation.id]);

  const toneFor = (level: string) =>
    level === "success" ? "green" : level === "warning" ? "amber" : level === "error" ? "red" : level === "simulated" ? "violet" : "gray";

  return (
    <Modal title={`Activity — ${automation.name}`} onClose={onClose} wide>
      {logs === null && <Spinner />}
      {logs !== null && logs.length === 0 && <p className="py-8 text-center text-sm text-ink-400">No activity yet — try a test run.</p>}
      <ul className="space-y-2">
        {logs?.map((log) => (
          <li key={log.id} className="flex items-start gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm">
            <Badge tone={toneFor(log.level) as never}>{log.level}</Badge>
            <span className="flex-1 text-ink-700">{log.message}</span>
            <span className="shrink-0 text-xs text-ink-400">{formatDate(log.created_at)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
