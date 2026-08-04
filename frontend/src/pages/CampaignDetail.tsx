import { ArrowLeft, Mail, Pause, Pencil, Play, RefreshCw, Send, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  deleteCampaign,
  fetchCampaign,
  fetchCampaignMembers,
  fetchCampaignSends,
  fetchTemplates,
  pauseCampaign,
  removeCampaignMember,
  runCampaignTick,
  startCampaign,
  updateCampaign,
} from "../api/client";
import CampaignForm, { campaignToForm } from "../components/CampaignForm";
import { Badge, Button, Card, ErrorNote, Modal, PageContainer, PageHeader, SampleBadge, Spinner, TableShell, Td, Th } from "../components/ui";
import { CAMPAIGN_STATUS_TONE, formatDate, titleCase } from "../lib/format";
import type { Campaign, CampaignMember, EmailSendRecord, EmailTemplate } from "../types";

type Tab = "members" | "sends";

export default function CampaignDetail() {
  const { id } = useParams();
  const campaignId = Number(id);
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [sends, setSends] = useState<EmailSendRecord[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tab, setTab] = useState<Tab>("members");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchCampaign(campaignId).then(setCampaign).catch((err) => setError(err instanceof Error ? err.message : "Not found"));
    fetchCampaignMembers(campaignId).then(setMembers).catch(() => undefined);
    fetchCampaignSends(campaignId).then(setSends).catch(() => undefined);
  }, [campaignId]);

  useEffect(() => {
    load();
    fetchTemplates().then(setTemplates).catch(() => undefined);
  }, [load]);

  async function act(action: () => Promise<unknown>, message?: string) {
    setError(null);
    try {
      await action();
      if (message) {
        setNotice(message);
        setTimeout(() => setNotice(null), 3500);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  if (!campaign) {
    return (
      <PageContainer>
        <ErrorNote message={error} />
        {!error && <Spinner />}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link to="/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> All campaigns
      </Link>

      <PageHeader
        icon={Send}
        title={campaign.name}
        subtitle={`Sends ${campaign.send_window_start}–${campaign.send_window_end}, up to ${campaign.daily_limit}/day. The background scheduler processes due emails automatically — "Process now" runs a pass immediately.`}
        actions={
          <>
            <SampleBadge show={campaign.is_sample} />
            <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? "gray"}>{titleCase(campaign.status)}</Badge>
            {campaign.status === "running" ? (
              <Button variant="secondary" onClick={() => act(() => pauseCampaign(campaignId), "Campaign paused.")}>
                <Pause size={15} /> Pause
              </Button>
            ) : (
              <Button onClick={() => act(() => startCampaign(campaignId), "Campaign running — due emails go out inside the sending window.")}>
                <Play size={15} /> Start
              </Button>
            )}
            <Button variant="secondary" onClick={() => act(async () => {
              const r = await runCampaignTick();
              setNotice(`${r.emails_processed} due email(s) processed.`);
            })}>
              <RefreshCw size={15} /> Process now
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit
            </Button>
            <Button
              variant="ghost"
              className="!text-danger-600"
              onClick={() => {
                if (window.confirm("Delete this campaign? Send history is kept, membership is removed.")) {
                  act(() => deleteCampaign(campaignId)).then(() => navigate("/campaigns"));
                }
              }}
            >
              <Trash2 size={15} />
            </Button>
          </>
        }
      />
      <ErrorNote message={error} />
      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Leads", campaign.member_count],
            ["Sent", campaign.stats.emails_sent ?? 0],
            ["Opened", campaign.stats.opened ?? 0],
            ["Replied", campaign.stats.replied ?? 0],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="p-4 text-center">
            <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 font-display text-sm font-bold text-ink-900">Sequence</h2>
        <div className="flex flex-wrap items-center gap-2">
          {campaign.steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-xs font-semibold text-ink-400">+{step.delay_days}d →</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700">
                <Mail size={12} /> {step.template_name}
              </span>
            </div>
          ))}
          {campaign.steps.length === 0 && <p className="text-sm text-ink-400">No steps yet — edit the campaign to add emails.</p>}
        </div>
      </Card>

      <div className="mb-3 flex gap-1 rounded-xl bg-ink-100 p-1">
        {(
          [
            ["members", `Leads (${members.length})`, Users],
            ["sends", `Send log (${sends.length})`, Mail],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key ? "bg-white text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-700"
            }`}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <TableShell>
          <thead>
            <tr>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Step</Th>
              <Th>Next send</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <Td className="font-semibold text-ink-800">{member.company_name}</Td>
                <Td>{member.email || "—"}</Td>
                <Td>
                  <Badge tone={member.status === "replied" ? "green" : member.status === "completed" ? "blue" : "gray"}>{titleCase(member.status)}</Badge>
                </Td>
                <Td>
                  {member.current_step} / {campaign.steps.length}
                </Td>
                <Td className="text-ink-500">{formatDate(member.next_send_at)}</Td>
                <Td>
                  <button
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                    onClick={() => act(() => removeCampaignMember(campaignId, member.id), "Lead removed from the campaign.")}
                  >
                    <Trash2 size={14} />
                  </button>
                </Td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-ink-400" colSpan={6}>
                  No leads yet — select leads in the workspace and choose "Add to campaign".
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      {tab === "sends" && (
        <TableShell>
          <thead>
            <tr>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
              <Th>Engagement</Th>
              <Th>Sent</Th>
            </tr>
          </thead>
          <tbody>
            {sends.map((send) => (
              <tr key={send.id}>
                <Td>
                  <p className="font-semibold text-ink-800">{send.company_name}</p>
                  <p className="text-xs text-ink-400">{send.to_email}</p>
                </Td>
                <Td className="max-w-[280px] truncate">{send.subject}</Td>
                <Td>
                  <Badge tone={send.status === "sent" ? "green" : send.status === "failed" ? "red" : "violet"}>{titleCase(send.status)}</Badge>
                  {send.error_message && <p className="mt-0.5 max-w-[200px] truncate text-xs text-danger-600">{send.error_message}</p>}
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    {send.opened && <Badge tone="blue">Opened</Badge>}
                    {send.replied && <Badge tone="green">Replied</Badge>}
                    {!send.opened && !send.replied && <span className="text-xs text-ink-400">—</span>}
                  </div>
                </Td>
                <Td className="text-ink-500">{formatDate(send.sent_at)}</Td>
              </tr>
            ))}
            {sends.length === 0 && (
              <tr>
                <Td className="py-10 text-center text-ink-400" colSpan={5}>
                  No emails sent yet.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      {editing && (
        <Modal title="Edit campaign" onClose={() => setEditing(false)} wide>
          <CampaignForm
            templates={templates}
            initial={campaignToForm(campaign)}
            saving={saving}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (value) => {
              setSaving(true);
              try {
                await updateCampaign(campaignId, value);
                setEditing(false);
                load();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save");
              } finally {
                setSaving(false);
              }
            }}
          />
        </Modal>
      )}
    </PageContainer>
  );
}
