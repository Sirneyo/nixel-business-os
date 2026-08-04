import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { deleteLead, fetchLead, updateLead } from "../api/client";
import { EMAIL_STATUS_TONE, QUALIFICATION_TONE, SOURCE_TONE, formatDate, titleCase } from "../lib/format";
import type { LeadFull } from "../types";
import { Badge, Button, ErrorNote, FormField, Input, Modal, SampleBadge, Spinner, Textarea } from "./ui";

export default function LeadDetailModal({
  leadId,
  onClose,
  onChanged,
}: {
  leadId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<LeadFull | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLead(leadId)
      .then((l) => {
        setLead(l);
        setForm({
          company_name: l.company_name,
          website: l.website,
          industry: l.industry,
          location: l.location,
          contact_name: l.contact_name,
          contact_role: l.contact_role,
          email: l.email,
          notes: l.notes,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load lead"));
  }, [leadId]);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateLead(leadId, form);
      setLead(updated);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this lead permanently? This also removes it from campaigns and the pipeline.")) return;
    await deleteLead(leadId);
    onChanged();
    onClose();
  }

  return (
    <Modal title={lead?.company_name ?? "Lead"} onClose={onClose} wide>
      <ErrorNote message={error} />
      {!lead && !error && <Spinner />}
      {lead && !editing && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <SampleBadge show={lead.is_sample} />
            <Badge tone={QUALIFICATION_TONE[lead.qualification_status] ?? "gray"}>{titleCase(lead.qualification_status)}</Badge>
            <Badge tone={EMAIL_STATUS_TONE[lead.email_status] ?? "gray"}>Email: {titleCase(lead.email_status)}</Badge>
            <Badge tone={SOURCE_TONE[lead.source] ?? "gray"}>{titleCase(lead.source)}</Badge>
            <span className="text-xs text-ink-400">Discovered {formatDate(lead.discovered_at)}</span>
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
              Why this lead was {lead.qualification_status} · score {Math.round(lead.relevance_score)}/100
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">{lead.qualification_note || "No assessment recorded yet."}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Website">
              {lead.website ? (
                <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                  {lead.website} <ExternalLink size={12} />
                </a>
              ) : (
                "—"
              )}
            </DetailItem>
            <DetailItem label="Industry / location">{[lead.industry, lead.location].filter(Boolean).join(" · ") || "—"}</DetailItem>
            <DetailItem label="Contact">{lead.contact_name ? `${lead.contact_name}${lead.contact_role ? ` (${lead.contact_role})` : ""}` : "—"}</DetailItem>
            <DetailItem label="Email">
              {lead.email || "—"}
              {lead.email_check_detail && <span className="mt-0.5 block text-xs text-ink-400">{lead.email_check_detail}</span>}
            </DetailItem>
          </div>

          {lead.description && <DetailItem label="Business description">{lead.description}</DetailItem>}
          {lead.research_summary && <DetailItem label="Website research">{lead.research_summary}</DetailItem>}
          {lead.notes && <DetailItem label="Notes">{lead.notes}</DetailItem>}

          {(lead.campaigns.length > 0 || lead.pipeline_stage) && (
            <div className="flex flex-wrap gap-2">
              {lead.campaigns.map((c) => (
                <Badge key={c.campaign_id} tone="blue">
                  {c.campaign_name}: {titleCase(c.status)}
                </Badge>
              ))}
              {lead.pipeline_stage && <Badge tone="violet">Pipeline: {titleCase(lead.pipeline_stage)}</Badge>}
            </div>
          )}

          <div className="flex justify-between border-t border-ink-100 pt-4">
            <Button variant="ghost" className="!text-danger-600" onClick={remove}>
              <Trash2 size={14} /> Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit lead
            </Button>
          </div>
        </div>
      )}

      {lead && editing && (
        <div className="space-y-3">
          {(
            [
              ["company_name", "Company name"],
              ["website", "Website"],
              ["industry", "Industry"],
              ["location", "Location"],
              ["contact_name", "Contact name"],
              ["contact_role", "Contact role"],
              ["email", "Email"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} label={label}>
              <Input value={form[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </FormField>
          ))}
          <FormField label="Notes">
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Save changes</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}
