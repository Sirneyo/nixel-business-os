// API contracts — mirror backend/app/serializers.py

export interface Lead {
  id: number;
  company_name: string;
  website: string;
  industry: string;
  location: string;
  contact_name: string;
  contact_role: string;
  email: string;
  email_status: "unverified" | "valid" | "risky" | "invalid" | "not_found";
  qualification_status: "pending" | "qualified" | "rejected";
  relevance_score: number;
  qualification_note: string;
  review_status: "new" | "approved" | "rejected";
  source: "engine" | "inbound" | "manual" | "api";
  source_detail: string;
  is_sample: boolean;
  discovered_at: string | null;
  campaign_count: number;
  in_pipeline: boolean;
}

export interface LeadFull extends Lead {
  description: string;
  email_check_detail: string;
  research_summary: string;
  notes: string;
  campaigns: { campaign_id: number; campaign_name: string; status: string }[];
  opportunity_id: number | null;
  pipeline_stage: string | null;
}

export interface LeadListResult {
  total: number;
  leads: Lead[];
}

export interface RunCounters {
  discovered: number;
  researched: number;
  contacts_found: number;
  emails_verified: number;
  qualified: number;
  rejected: number;
  saved: number;
}

export interface EngineRun {
  id: number;
  industry: string;
  target_customer: string;
  keywords: string;
  location: string;
  business_type: string;
  criteria: string;
  leads_requested: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current_stage: string;
  counters: RunCounters;
  error_message: string;
  is_sample: boolean;
  created_at: string | null;
  finished_at: string | null;
}

export interface RunEvent {
  id: number;
  stage: string;
  agent: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  company_name: string;
  created_at: string | null;
}

export interface RunDetail {
  run: EngineRun;
  events: RunEvent[];
  leads: Lead[];
}

export interface Stage {
  key: string;
  label: string;
}

export interface EmailBlock {
  type: "heading" | "text" | "button" | "divider" | "spacer" | "footer";
  text?: string;
  html?: string;
  url?: string;
  level?: number;
  height?: number;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  blocks: EmailBlock[];
  is_sample: boolean;
  updated_at: string | null;
}

export interface MergeField {
  token: string;
  label: string;
  sample: string;
}

export interface CampaignStep {
  id: number;
  position: number;
  template_id: number;
  template_name: string;
  delay_days: number;
}

export interface CampaignStats {
  emails_sent?: number;
  opened?: number;
  replied?: number;
  failed?: number;
}

export interface Campaign {
  id: number;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  sender_name: string;
  sender_email: string;
  daily_limit: number;
  send_window_start: string;
  send_window_end: string;
  send_days: string;
  is_sample: boolean;
  created_at: string | null;
  steps: CampaignStep[];
  member_count: number;
  stats: CampaignStats;
}

export interface CampaignMember {
  id: number;
  lead_id: number;
  company_name: string;
  email: string;
  status: string;
  current_step: number;
  next_send_at: string | null;
}

export interface EmailSendRecord {
  id: number;
  lead_id: number;
  company_name: string;
  to_email: string;
  subject: string;
  step_position: number;
  status: "simulated" | "sent" | "failed";
  error_message: string;
  opened: boolean;
  replied: boolean;
  sent_at: string | null;
}

export interface AutomationStep {
  id: number;
  position: number;
  kind: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: number;
  name: string;
  trigger: string;
  status: "active" | "paused";
  simulation_mode: boolean;
  is_sample: boolean;
  created_at: string | null;
  steps: AutomationStep[];
  stats: { active?: number; completed?: number; stopped?: number };
}

export interface AutomationLogEntry {
  id: number;
  lead_id: number | null;
  level: string;
  message: string;
  created_at: string | null;
}

export interface AutomationOptions {
  triggers: { key: string; label: string }[];
  step_kinds: { key: string; label: string }[];
}

export interface Opportunity {
  id: number;
  lead_id: number;
  company_name: string;
  contact_name: string;
  email: string;
  title: string;
  stage: string;
  value: number;
  notes: string;
  is_sample: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineBoard {
  stages: { stage: string; label: string; opportunities: Opportunity[] }[];
}

export interface OpportunityDetail {
  opportunity: Opportunity;
  lead: {
    id: number;
    company_name: string;
    website: string;
    contact_name: string;
    email: string;
    qualification_note: string;
    research_summary: string;
    notes: string;
  };
  emails: EmailSendRecord[];
  history: { id: number; message: string; created_at: string | null }[];
}

export interface ProviderStatus {
  configured: boolean;
  name?: string;
}

export interface AppSettings {
  values: Record<string, string>;
  providers: {
    ai: ProviderStatus;
    lead_search: ProviderStatus;
    email_verify: ProviderStatus;
    email_sender: ProviderStatus;
    inbound_webhook: { configured: boolean };
  };
  secrets_configured: Record<string, boolean>;
  public_base_url: string;
}

export interface DashboardData {
  kpis: {
    total_leads: number;
    qualified_leads: number;
    verified_emails: number;
    inbound_leads: number;
    emails_sent: number;
    replies: number;
    running_campaigns: number;
    active_automations: number;
    open_opportunities: number;
    won_deals: number;
  };
  last_run: { id: number; status: string; saved: number; created_at: string | null } | null;
  activity: { id: number; entity_type: string; message: string; created_at: string | null }[];
}

export interface InboundStatus {
  configured: boolean;
  endpoint: string;
  header: string;
}
