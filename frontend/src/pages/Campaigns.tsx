import { Mail, Plus, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { createCampaign, fetchCampaigns, fetchTemplates } from "../api/client";
import CampaignForm, { type CampaignFormValue, emptyCampaignForm } from "../components/CampaignForm";
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, PageContainer, PageHeader, SampleBadge } from "../components/ui";
import { CAMPAIGN_STATUS_TONE, titleCase } from "../lib/format";
import type { Campaign, EmailTemplate } from "../types";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchCampaigns().then(setCampaigns).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    load();
    fetchTemplates().then(setTemplates).catch(() => undefined);
  }, [load]);

  async function handleCreate(value: CampaignFormValue) {
    setSaving(true);
    setError(null);
    try {
      await createCampaign(value);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Send}
        title="Campaigns"
        subtitle="Email sequences sent to your verified leads on a schedule you control — sender, daily limit, sending window and follow-up gaps."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New campaign
          </Button>
        }
      />
      <ErrorNote message={error} />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          hint="Create a campaign, pick email templates for each step, then add leads from the workspace."
          action={<Button onClick={() => setShowCreate(true)}>Create your first campaign</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} to={`/campaigns/${campaign.id}`}>
              <Card className="h-full p-5 transition hover:border-brand-300 hover:shadow-pop">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-ink-900">{campaign.name}</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SampleBadge show={campaign.is_sample} />
                    <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? "gray"}>{titleCase(campaign.status)}</Badge>
                  </div>
                </div>
                <p className="mb-4 flex items-center gap-1.5 text-sm text-ink-500">
                  <Mail size={14} /> {campaign.steps.length} email step{campaign.steps.length === 1 ? "" : "s"} · {campaign.member_count} lead{campaign.member_count === 1 ? "" : "s"}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Sent", campaign.stats.emails_sent ?? 0],
                      ["Opened", campaign.stats.opened ?? 0],
                      ["Replied", campaign.stats.replied ?? 0],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-50 py-2">
                      <p className="font-display text-lg font-bold text-ink-900">{value}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="New campaign" onClose={() => setShowCreate(false)} wide>
          <CampaignForm
            templates={templates}
            initial={emptyCampaignForm()}
            saving={saving}
            submitLabel="Create campaign"
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      )}
    </PageContainer>
  );
}
