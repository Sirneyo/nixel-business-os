import { KanbanSquare, Mail, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { deleteOpportunity, fetchBoard, fetchOpportunity, updateOpportunity } from "../api/client";
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
  SampleBadge,
  Spinner,
  Textarea,
} from "../components/ui";
import { formatDate, titleCase } from "../lib/format";
import type { OpportunityDetail, PipelineBoard } from "../types";

export default function Pipeline() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchBoard().then(setBoard).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function drop(stage: string) {
    setOverStage(null);
    if (dragId === null) return;
    try {
      await updateOpportunity(dragId, { stage });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setDragId(null);
    }
  }

  const totalValue = board?.stages.flatMap((s) => s.opportunities).reduce((sum, o) => sum + o.value, 0) ?? 0;

  return (
    <PageContainer className="flex flex-col">
      <PageHeader
        icon={KanbanSquare}
        title="Opportunity Pipeline"
        subtitle={`Drag opportunities between stages as deals progress. ${totalValue > 0 ? `Total pipeline value: £${totalValue.toLocaleString()}.` : ""}`}
      />
      <ErrorNote message={error} />
      {!board && !error && <Spinner />}

      {board && (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
          {board.stages.map((column) => (
            <div
              key={column.stage}
              className={`flex w-64 shrink-0 flex-col rounded-2xl border p-2.5 transition-colors ${
                overStage === column.stage ? "border-brand-400 bg-brand-50/60" : "border-ink-200/70 bg-ink-100/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(column.stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === column.stage ? null : s))}
              onDrop={() => drop(column.stage)}
            >
              <div className="mb-2 flex items-center justify-between px-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">{column.label}</span>
                <Badge tone={column.stage === "won" ? "green" : column.stage === "lost" ? "red" : "gray"}>{column.opportunities.length}</Badge>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {column.opportunities.map((opp) => (
                  <Card
                    key={opp.id}
                    className={`cursor-grab p-3 transition hover:border-brand-300 ${dragId === opp.id ? "opacity-50" : ""}`}
                    // Native HTML5 drag & drop keeps the starter dependency-free.
                  >
                    <div draggable onDragStart={() => setDragId(opp.id)} onDragEnd={() => setDragId(null)} onClick={() => setDetailId(opp.id)}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold leading-snug text-ink-800">{opp.company_name}</p>
                        <SampleBadge show={opp.is_sample} />
                      </div>
                      {opp.contact_name && <p className="mt-0.5 text-xs text-ink-400">{opp.contact_name}</p>}
                      {opp.value > 0 && <p className="mt-1.5 text-xs font-bold text-brand-700">£{opp.value.toLocaleString()}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailId !== null && (
        <OpportunityModal
          opportunityId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </PageContainer>
  );
}

function OpportunityModal({ opportunityId, onClose, onChanged }: { opportunityId: number; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOpportunity(opportunityId)
      .then((d) => {
        setDetail(d);
        setTitle(d.opportunity.title);
        setValue(d.opportunity.value);
        setNotes(d.opportunity.notes);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [opportunityId]);

  async function save() {
    setSaving(true);
    try {
      await updateOpportunity(opportunityId, { title, value, notes });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this opportunity from the pipeline? The lead itself is kept.")) return;
    await deleteOpportunity(opportunityId);
    onChanged();
    onClose();
  }

  return (
    <Modal title={detail?.opportunity.company_name ?? "Opportunity"} onClose={onClose} wide>
      <ErrorNote message={error} />
      {!detail && !error && <Spinner />}
      {detail && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet">{titleCase(detail.opportunity.stage)}</Badge>
            {detail.lead.email && <Badge tone="gray">{detail.lead.email}</Badge>}
            {detail.lead.website && (
              <a href={detail.lead.website} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 hover:underline">
                {detail.lead.website}
              </a>
            )}
          </div>

          {detail.lead.qualification_note && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3.5 text-sm text-ink-700">{detail.lead.qualification_note}</div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField label="Deal value (£)">
              <Input type="number" min={0} value={value} onChange={(e) => setValue(Number(e.target.value) || 0)} />
            </FormField>
          </div>
          <FormField label="Notes">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>

          {detail.emails.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Email history</p>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {detail.emails.map((send) => (
                  <li key={send.id} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                    <Mail size={13} className="shrink-0 text-ink-400" />
                    <span className="flex-1 truncate">{send.subject}</span>
                    {send.replied && <Badge tone="green">Replied</Badge>}
                    {send.opened && !send.replied && <Badge tone="blue">Opened</Badge>}
                    <span className="shrink-0 text-xs text-ink-400">{formatDate(send.sent_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.history.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">Activity</p>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-sm text-ink-600">
                {detail.history.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span className="flex-1">{item.message}</span>
                    <span className="shrink-0 text-xs text-ink-400">{formatDate(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between border-t border-ink-100 pt-4">
            <Button variant="ghost" className="!text-danger-600" onClick={remove}>
              <Trash2 size={14} /> Remove
            </Button>
            <Button loading={saving} onClick={save}>Save changes</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
