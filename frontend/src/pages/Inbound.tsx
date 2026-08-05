import { Code2, Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { API_URL, fetchInboundLeads, fetchInboundStatus } from "../api/client";
import LeadDetailModal from "../components/LeadDetailModal";
import {
  Badge,
  Card,
  ErrorNote,
  PageContainer,
  PageHeader,
  Pagination,
  SampleBadge,
  SearchInput,
  TableShell,
  Td,
  Th,
} from "../components/ui";
import { EMAIL_STATUS_TONE, formatDate, titleCase } from "../lib/format";
import type { InboundStatus, Lead } from "../types";

const PAGE_SIZE = 20;

export default function Inbound() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InboundStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchInboundLeads(search, PAGE_SIZE, page * PAGE_SIZE)
      .then((result) => {
        setLeads(result.leads);
        setTotal(result.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [search, page]);

  useEffect(() => {
    load();
    fetchInboundStatus().then(setStatus).catch(() => undefined);
  }, [load]);

  const snippet = `fetch("${status?.endpoint ?? `${API_URL}/api/inbound/lead`}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_WEBHOOK_KEY"
  },
  body: JSON.stringify({
    company_name: "Acme Ltd",
    contact_name: "Jane Smith",
    email: "jane@acme.com",
    message: "Submitted your contact form",
    source_detail: "Website form"
  })
});`;

  return (
    <PageContainer>
      <PageHeader
        icon={Inbox}
        title="Inbound Leads"
        subtitle="Leads that came to you — from website forms, landing pages, webhooks or the API. They join the same workspace, clearly marked as inbound."
      />
      <ErrorNote message={error} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Code2 size={16} className="text-brand-600" />
            <h2 className="font-display text-sm font-bold text-ink-900">Connect your website or funnel</h2>
            {status && (
              <Badge tone={status.configured ? "green" : "amber"}>
                {status.configured ? "Webhook key configured" : "Set INBOUND_WEBHOOK_KEY first"}
              </Badge>
            )}
          </div>
          <p className="mb-3 text-sm text-ink-500">
            POST JSON to the endpoint below with your secret key in the <code className="rounded bg-ink-100 px-1 text-xs">X-API-Key</code> header.
            A full working example form is in <code className="rounded bg-ink-100 px-1 text-xs">examples/inbound-form.html</code>.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs leading-relaxed text-ink-100">{snippet}</pre>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 font-display text-sm font-bold text-ink-900">Other ways in</h2>
          <ul className="space-y-2 text-sm text-ink-600">
            <li>• <strong>Manual entry</strong> — use "Add lead" in the Lead Workspace.</li>
            <li>• <strong>Landing pages</strong> — point any form handler at the webhook.</li>
            <li>• <strong>Other systems</strong> — Zapier/Make HTTP modules work out of the box.</li>
            <li>• <strong>Automations</strong> — the "New inbound lead received" trigger fires for every arrival.</li>
          </ul>
        </Card>
      </div>

      <Card className="mb-4 flex justify-end p-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search inbound leads…" />
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Company</Th>
            <Th>Contact</Th>
            <Th>Email</Th>
            <Th>Came from</Th>
            <Th>Received</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="cursor-pointer transition hover:bg-ink-50/70" onClick={() => setDetailId(lead.id)}>
              <Td>
                <span className="flex items-center gap-2 font-semibold text-ink-800">
                  {lead.company_name} <SampleBadge show={lead.is_sample} />
                </span>
              </Td>
              <Td>{lead.contact_name || "—"}</Td>
              <Td>
                <p className="max-w-[200px] truncate">{lead.email || "—"}</p>
                <Badge tone={EMAIL_STATUS_TONE[lead.email_status] ?? "gray"}>{titleCase(lead.email_status)}</Badge>
              </Td>
              <Td>
                <Badge tone="blue">{lead.source_detail || "Inbound"}</Badge>
              </Td>
              <Td className="text-ink-500">{formatDate(lead.discovered_at)}</Td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-ink-400" colSpan={5}>
                No inbound leads yet — connect a form using the snippet above.
              </Td>
            </tr>
          )}
        </tbody>
      </TableShell>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      {detailId !== null && <LeadDetailModal leadId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </PageContainer>
  );
}
