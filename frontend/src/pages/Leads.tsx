import { CheckCircle2, Download, KanbanSquare, Plus, Send, Users, Workflow, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  addLeadsToCampaign,
  approveLeads,
  createManualLead,
  enrollLeads,
  exportLeadsUrl,
  fetchAutomations,
  fetchCampaigns,
  fetchLeads,
  rejectLeads,
  sendLeadsToPipeline,
} from "../api/client";
import LeadDetailModal from "../components/LeadDetailModal";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  FormField,
  Input,
  Modal,
  PageContainer,
  PageHeader,
  Pagination,
  SampleBadge,
  SearchInput,
  Select,
  TableShell,
  Td,
  Textarea,
  Th,
} from "../components/ui";
import { EMAIL_STATUS_TONE, QUALIFICATION_TONE, REVIEW_TONE, SOURCE_TONE, titleCase } from "../lib/format";
import type { Automation, Campaign, Lead } from "../types";

const PAGE_SIZE = 20;

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ source: "", qualification: "", review: "", email_status: "" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [showAutomationPicker, setShowAutomationPicker] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);

  const load = useCallback(() => {
    fetchLeads({ search: search || undefined, ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((result) => {
        setLeads(result.leads);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leads"));
  }, [search, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  const ids = [...selected];

  async function act(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      setNotice(message);
      setSelected(new Set());
      load();
      setTimeout(() => setNotice(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Users}
        title="Lead Workspace"
        subtitle="Every lead the system has found or received, with its research, verification result and a written reason for every qualification decision."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.open(exportLeadsUrl({ search, ...filters }, ids), "_blank")}>
              <Download size={15} /> Export CSV
            </Button>
            <Button onClick={() => setShowManual(true)}>
              <Plus size={15} /> Add lead
            </Button>
          </>
        }
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search company, contact, email, location…" />
        <Select className="!w-auto" value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
          <option value="">All sources</option>
          <option value="engine">Engine</option>
          <option value="inbound">Inbound</option>
          <option value="manual">Manual</option>
        </Select>
        <Select className="!w-auto" value={filters.qualification} onChange={(e) => setFilter("qualification", e.target.value)}>
          <option value="">All qualification</option>
          <option value="qualified">Qualified</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending</option>
        </Select>
        <Select className="!w-auto" value={filters.review} onChange={(e) => setFilter("review", e.target.value)}>
          <option value="">All review states</option>
          <option value="new">New</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select className="!w-auto" value={filters.email_status} onChange={(e) => setFilter("email_status", e.target.value)}>
          <option value="">All email states</option>
          <option value="valid">Valid</option>
          <option value="risky">Risky</option>
          <option value="invalid">Invalid</option>
          <option value="not_found">Not found</option>
        </Select>
      </Card>

      {ids.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 border-brand-200 bg-brand-50/60 p-3">
          <span className="mr-2 text-sm font-semibold text-brand-800">{ids.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => act(() => approveLeads(ids), `${ids.length} lead(s) approved.`)}>
            <CheckCircle2 size={14} /> Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act(() => rejectLeads(ids), `${ids.length} lead(s) rejected.`)}>
            <XCircle size={14} /> Reject
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              fetchCampaigns().then(setCampaigns);
              setShowCampaignPicker(true);
            }}
          >
            <Send size={14} /> Add to campaign
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              fetchAutomations().then(setAutomations);
              setShowAutomationPicker(true);
            }}
          >
            <Workflow size={14} /> Add to automation
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act(() => sendLeadsToPipeline(ids), "Sent to the pipeline.")}>
            <KanbanSquare size={14} /> Send to pipeline
          </Button>
        </Card>
      )}

      <TableShell>
        <thead>
          <tr>
            <Th className="w-10">
              <input type="checkbox" checked={leads.length > 0 && selected.size === leads.length} onChange={toggleAll} />
            </Th>
            <Th>Company</Th>
            <Th>Contact</Th>
            <Th>Email</Th>
            <Th>Score</Th>
            <Th>Qualification</Th>
            <Th>Review</Th>
            <Th>Source</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="cursor-pointer transition hover:bg-ink-50/70" onClick={() => setDetailId(lead.id)}>
              <Td className="w-10" >
                <input type="checkbox" checked={selected.has(lead.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(lead.id)} />
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-semibold text-ink-800">{lead.company_name}</p>
                    <p className="text-xs text-ink-400">{lead.location || lead.industry || "—"}</p>
                  </div>
                  <SampleBadge show={lead.is_sample} />
                </div>
              </Td>
              <Td>
                <p className="text-ink-700">{lead.contact_name || "—"}</p>
                <p className="text-xs text-ink-400">{lead.contact_role}</p>
              </Td>
              <Td>
                <p className="max-w-[180px] truncate text-ink-700">{lead.email || "—"}</p>
                <Badge tone={EMAIL_STATUS_TONE[lead.email_status] ?? "gray"}>{titleCase(lead.email_status)}</Badge>
              </Td>
              <Td className="font-bold text-ink-800">{Math.round(lead.relevance_score)}</Td>
              <Td>
                <Badge tone={QUALIFICATION_TONE[lead.qualification_status] ?? "gray"}>{titleCase(lead.qualification_status)}</Badge>
              </Td>
              <Td>
                <Badge tone={REVIEW_TONE[lead.review_status] ?? "gray"}>{titleCase(lead.review_status)}</Badge>
              </Td>
              <Td>
                <Badge tone={SOURCE_TONE[lead.source] ?? "gray"}>{titleCase(lead.source)}</Badge>
              </Td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-ink-400" colSpan={8}>
                No leads match — run the Lead Engine or adjust the filters.
              </Td>
            </tr>
          )}
        </tbody>
      </TableShell>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {detailId !== null && <LeadDetailModal leadId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}

      {showManual && (
        <ManualLeadModal
          onClose={() => setShowManual(false)}
          onCreated={() => {
            setShowManual(false);
            load();
          }}
        />
      )}

      {showCampaignPicker && (
        <Modal title="Add to campaign" onClose={() => setShowCampaignPicker(false)}>
          {campaigns.length === 0 && <p className="text-sm text-ink-500">No campaigns yet — create one first.</p>}
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-left text-sm font-medium text-ink-700 transition hover:border-brand-400 hover:bg-brand-50"
                  onClick={() => {
                    setShowCampaignPicker(false);
                    act(() => addLeadsToCampaign(c.id, ids), `Added to "${c.name}".`);
                  }}
                >
                  {c.name}
                  <Badge tone="gray">{c.member_count} leads</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {showAutomationPicker && (
        <Modal title="Add to automation" onClose={() => setShowAutomationPicker(false)}>
          {automations.length === 0 && <p className="text-sm text-ink-500">No automations yet — create one first.</p>}
          <ul className="space-y-2">
            {automations.map((a) => (
              <li key={a.id}>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-ink-200 px-4 py-3 text-left text-sm font-medium text-ink-700 transition hover:border-brand-400 hover:bg-brand-50"
                  onClick={() => {
                    setShowAutomationPicker(false);
                    act(() => enrollLeads(a.id, ids), `Enrolled in "${a.name}".`);
                  }}
                >
                  {a.name}
                  <Badge tone={a.status === "active" ? "green" : "amber"}>{a.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </PageContainer>
  );
}

function ManualLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", website: "", industry: "", location: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await createManualLead({ ...form, email: form.email || null });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
      setSaving(false);
    }
  }

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal title="Add a lead manually" onClose={onClose}>
      <ErrorNote message={error} />
      <div className="space-y-3">
        <FormField label="Company name">
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Contact name">
            <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Website">
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </FormField>
          <FormField label="Location">
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </FormField>
        </div>
        <FormField label="Industry">
          <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} value={form.message} onChange={(e) => set("message", e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={form.company_name.trim().length < 2} onClick={save}>Save lead</Button>
        </div>
      </div>
    </Modal>
  );
}
