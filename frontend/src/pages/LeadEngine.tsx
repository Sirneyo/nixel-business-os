import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Globe,
  History,
  Info,
  Mail,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  UserSearch,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { cancelRun, fetchRun, fetchRuns, startRun } from "../api/client";
import { Badge, Button, Card, ErrorNote, FormField, Input, PageContainer, PageHeader, SampleBadge, Textarea } from "../components/ui";
import { QUALIFICATION_TONE, RUN_STATUS_TONE, formatDate, titleCase } from "../lib/format";
import type { EngineRun, Lead, RunEvent } from "../types";

const STAGE_META: { key: string; label: string; icon: typeof Search }[] = [
  { key: "search", label: "Searching", icon: Search },
  { key: "discovery", label: "Discovering", icon: Globe },
  { key: "research", label: "Researching", icon: Bot },
  { key: "contacts", label: "Finding contacts", icon: UserSearch },
  { key: "verification", label: "Verifying emails", icon: ShieldCheck },
  { key: "assessment", label: "Assessing fit", icon: Sparkles },
  { key: "saving", label: "Saving leads", icon: CheckCircle2 },
];

const LEVEL_META = {
  info: { icon: Info, className: "text-ink-400" },
  success: { icon: CheckCircle2, className: "text-brand-600" },
  warning: { icon: AlertTriangle, className: "text-warn-600" },
  error: { icon: XCircle, className: "text-danger-600" },
} as const;

export default function LeadEngine() {
  const [run, setRun] = useState<EngineRun | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<EngineRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({
    industry: "",
    target_customer: "",
    keywords: "",
    location: "",
    business_type: "",
    criteria: "",
    leads_requested: 10,
  });
  const lastEventId = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(() => {
    fetchRuns()
      .then((runs) => {
        setHistory(runs);
        const active = runs.find((r) => r.status === "running" || r.status === "queued");
        if (active && !run) selectRun(active.id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectRun = useCallback((id: number) => {
    lastEventId.current = 0;
    setEvents([]);
    setLeads([]);
    fetchRun(id).then((detail) => {
      setRun(detail.run);
      setEvents(detail.events);
      setLeads(detail.leads);
      if (detail.events.length > 0) lastEventId.current = detail.events[detail.events.length - 1].id;
    });
  }, []);

  // Live polling while a run is active.
  useEffect(() => {
    if (!run || (run.status !== "running" && run.status !== "queued")) return;
    const timer = setInterval(async () => {
      try {
        const detail = await fetchRun(run.id, lastEventId.current);
        setRun(detail.run);
        setLeads(detail.leads);
        if (detail.events.length > 0) {
          lastEventId.current = detail.events[detail.events.length - 1].id;
          setEvents((prev) => [...prev, ...detail.events].slice(-400));
        }
        if (detail.run.status !== "running" && detail.run.status !== "queued") {
          fetchRuns().then(setHistory).catch(() => undefined);
        }
      } catch {
        // transient polling error — keep trying
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [run?.id, run?.status]);

  // Auto-scroll the activity feed.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const created = await startRun(form);
      lastEventId.current = 0;
      setEvents([]);
      setLeads([]);
      setRun(created);
      fetchRuns().then(setHistory).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    if (!run) return;
    const updated = await cancelRun(run.id);
    setRun(updated);
  }

  const isActive = run?.status === "running" || run?.status === "queued";
  const stageIndex = run ? STAGE_META.findIndex((s) => s.key === run.current_stage) : -1;

  function set(key: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Radar}
        title="Lead Generation Engine"
        subtitle="Describe your ideal customer, press start, and watch every stage work live: searching, discovering websites, researching, finding contacts, verifying emails and qualifying leads."
      />
      <ErrorNote message={error} />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ── Search brief ─────────────────────────────────────────────── */}
        <Card className="p-5 xl:col-span-1">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">Search brief</h2>
          <div className="space-y-3.5">
            <FormField label="Industry">
              <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Landscaping" />
            </FormField>
            <FormField label="Target customer">
              <Input value={form.target_customer} onChange={(e) => set("target_customer", e.target.value)} placeholder="e.g. family-run firms with an established local base" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Keywords">
                <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="garden design" />
              </FormField>
              <FormField label="Location">
                <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Leeds" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Business type">
                <Input value={form.business_type} onChange={(e) => set("business_type", e.target.value)} placeholder="agency, retail…" />
              </FormField>
              <FormField label="Leads required">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.leads_requested}
                  onChange={(e) => set("leads_requested", Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                />
              </FormField>
            </div>
            <FormField label="Extra search criteria" hint="Free text — the relevance assessment uses this too.">
              <Textarea rows={2} value={form.criteria} onChange={(e) => set("criteria", e.target.value)} placeholder="e.g. must have an active website; avoid national chains" />
            </FormField>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" loading={starting} disabled={isActive} onClick={handleStart}>
                <Radar size={15} /> Start engine
              </Button>
              {isActive && (
                <Button variant="danger" onClick={handleCancel}>
                  <Square size={14} /> Stop
                </Button>
              )}
            </div>
          </div>

          {/* Run history */}
          {history.length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                <History size={13} /> Previous runs
              </div>
              <ul className="space-y-1">
                {history.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <button
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-ink-50 ${run?.id === r.id ? "bg-brand-50" : ""}`}
                      onClick={() => selectRun(r.id)}
                    >
                      <span className="flex items-center gap-2 truncate text-ink-700">
                        #{r.id} {r.industry || r.business_type || "Run"} <SampleBadge show={r.is_sample} />
                      </span>
                      <Badge tone={RUN_STATUS_TONE[r.status] ?? "gray"}>{r.status}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* ── Live run view ────────────────────────────────────────────── */}
        <div className="space-y-4 xl:col-span-2">
          {/* Stage tracker */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink-900">
                {run ? `Run #${run.id}` : "No run selected"}
              </h2>
              {run && (
                <div className="flex items-center gap-2">
                  <SampleBadge show={run.is_sample} />
                  <Badge tone={RUN_STATUS_TONE[run.status] ?? "gray"}>{run.status}</Badge>
                  {run.created_at && <span className="text-xs text-ink-400">{formatDate(run.created_at)}</span>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {STAGE_META.map((stage, i) => {
                const Icon = stage.icon;
                const isCurrent = isActive && run?.current_stage === stage.key;
                const isDone = run && (run.status === "completed" || (stageIndex >= 0 && i < stageIndex));
                return (
                  <div key={stage.key} className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isCurrent
                          ? "bg-brand-600 text-white shadow-card animate-pulse-soft"
                          : isDone
                            ? "bg-brand-50 text-brand-700"
                            : "bg-ink-100 text-ink-400"
                      }`}
                    >
                      <Icon size={13} />
                      {stage.label}
                    </div>
                    {i < STAGE_META.length - 1 && <ChevronRight size={13} className="text-ink-300" />}
                  </div>
                );
              })}
            </div>

            {run && (
              <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {(
                  [
                    ["Discovered", run.counters.discovered],
                    ["Researched", run.counters.researched],
                    ["Contacts", run.counters.contacts_found],
                    ["Verified", run.counters.emails_verified],
                    ["Qualified", run.counters.qualified],
                    ["Rejected", run.counters.rejected],
                    ["Saved", run.counters.saved],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-ink-50 px-2 py-2.5 text-center">
                    <p className="font-display text-lg font-bold text-ink-900">{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {run?.error_message && <ErrorNote message={run.error_message} />}
          </Card>

          {/* Live activity feed */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink-900">Agent activity</h2>
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                  <span className="h-2 w-2 animate-pulse-soft rounded-full bg-brand-500" /> Live
                </span>
              )}
            </div>
            <div ref={feedRef} className="max-h-80 space-y-1 overflow-y-auto rounded-xl bg-ink-900 p-4 font-mono text-[12.5px] leading-relaxed">
              {events.length === 0 && <p className="text-ink-500">Start a run to watch the engine work…</p>}
              {events.map((event) => {
                const meta = LEVEL_META[event.level] ?? LEVEL_META.info;
                const Icon = meta.icon;
                return (
                  <div key={event.id} className="flex items-start gap-2 text-ink-200">
                    <Icon size={13} className={`mt-0.5 shrink-0 ${meta.className}`} />
                    <span>
                      <span className="font-semibold text-brand-400">{event.agent}</span>{" "}
                      <span className="text-ink-500">·</span> {event.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Leads produced by this run */}
          {leads.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink-900">Leads from this run</h2>
                <Link to="/leads" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Open the workspace →
                </Link>
              </div>
              <ul className="divide-y divide-ink-100">
                {leads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-800">{lead.company_name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {lead.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={11} /> {lead.email}
                          </span>
                        ) : (
                          "No email found"
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-bold text-ink-500">{Math.round(lead.relevance_score)}/100</span>
                      <Badge tone={QUALIFICATION_TONE[lead.qualification_status] ?? "gray"}>{titleCase(lead.qualification_status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
