import type {
  AppSettings,
  Automation,
  AutomationLogEntry,
  AutomationOptions,
  Campaign,
  CampaignMember,
  DashboardData,
  EmailSendRecord,
  EmailTemplate,
  EngineRun,
  InboundStatus,
  LeadFull,
  LeadListResult,
  MergeField,
  OpportunityDetail,
  PipelineBoard,
  RunDetail,
  Stage,
} from "../types";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

const TOKEN_KEY = "nixel_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    // Session expired or signed out elsewhere — drop the token and let the
    // app switch to the login screen.
    setToken(null);
    window.dispatchEvent(new Event("nixel:unauthorized"));
  }
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // keep the status text
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ── Dashboard ───────────────────────────────────────────────────────────────
export const fetchDashboard = () => get<DashboardData>("/api/dashboard");

// ── Engine ──────────────────────────────────────────────────────────────────
export const fetchStages = () => get<Stage[]>("/api/engine/stages");
export const fetchRuns = () => get<EngineRun[]>("/api/engine/runs");
export const fetchRun = (id: number, afterEventId = 0) =>
  get<RunDetail>(`/api/engine/runs/${id}?after_event_id=${afterEventId}`);
export const startRun = (payload: Record<string, unknown>) => post<EngineRun>("/api/engine/runs", payload);
export const cancelRun = (id: number) => post<EngineRun>(`/api/engine/runs/${id}/cancel`);

// ── Leads ───────────────────────────────────────────────────────────────────
export interface LeadFilters {
  search?: string;
  source?: string;
  qualification?: string;
  review?: string;
  email_status?: string;
  limit?: number;
  offset?: number;
}

function leadQuery(filters: LeadFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const fetchLeads = (filters: LeadFilters = {}) => get<LeadListResult>(`/api/leads?${leadQuery(filters)}`);
export const fetchLead = (id: number) => get<LeadFull>(`/api/leads/${id}`);
export const updateLead = (id: number, payload: Record<string, unknown>) => patch<LeadFull>(`/api/leads/${id}`, payload);
export const deleteLead = (id: number) => del<{ deleted: number }>(`/api/leads/${id}`);
export const createManualLead = (payload: Record<string, unknown>) => post<LeadFull>("/api/leads", payload);
export const approveLeads = (leadIds: number[]) => post<{ approved: number }>("/api/leads/approve", { lead_ids: leadIds });
export const rejectLeads = (leadIds: number[]) => post<{ rejected: number }>("/api/leads/reject", { lead_ids: leadIds });
export const addLeadsToCampaign = (campaignId: number, leadIds: number[]) =>
  post<{ added: number; campaign: string }>(`/api/leads/add-to-campaign/${campaignId}`, { lead_ids: leadIds });
export const sendLeadsToPipeline = (leadIds: number[]) =>
  post<{ created: number }>("/api/leads/send-to-pipeline", { lead_ids: leadIds });
export const exportLeadsUrl = (filters: LeadFilters = {}, ids: number[] = []) => {
  const query = leadQuery(filters);
  const idPart = ids.length ? `${query ? "&" : ""}ids=${ids.join(",")}` : "";
  return `${API_URL}/api/leads/export?${query}${idPart}`;
};

// ── Inbound ─────────────────────────────────────────────────────────────────
export const fetchInboundStatus = () => get<InboundStatus>("/api/inbound/status");
export const fetchInboundLeads = (search = "", limit = 25, offset = 0) =>
  get<LeadListResult>(`/api/inbound/recent?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`);

// ── Templates ───────────────────────────────────────────────────────────────
export const fetchTemplates = () => get<EmailTemplate[]>("/api/templates");
export const fetchTemplate = (id: number) => get<EmailTemplate>(`/api/templates/${id}`);
export const fetchMergeFields = () => get<MergeField[]>("/api/templates/merge-fields");
export const createTemplate = (payload: Record<string, unknown>) => post<EmailTemplate>("/api/templates", payload);
export const updateTemplate = (id: number, payload: Record<string, unknown>) => put<EmailTemplate>(`/api/templates/${id}`, payload);
export const deleteTemplate = (id: number) => del<{ deleted: number }>(`/api/templates/${id}`);
export const previewTemplate = (id: number) =>
  post<{ subject: string; html: string; tokens_used: string[] }>(`/api/templates/${id}/preview`);
export const sendTestEmail = (id: number, toEmail: string) =>
  post<{ status: string; detail: string; sender: string }>(`/api/templates/${id}/send-test`, { to_email: toEmail });

// ── Campaigns ───────────────────────────────────────────────────────────────
export const fetchCampaigns = () => get<Campaign[]>("/api/campaigns");
export const fetchCampaign = (id: number) => get<Campaign>(`/api/campaigns/${id}`);
export const createCampaign = (payload: object) => post<Campaign>("/api/campaigns", payload);
export const updateCampaign = (id: number, payload: object) => put<Campaign>(`/api/campaigns/${id}`, payload);
export const deleteCampaign = (id: number) => del<{ deleted: number }>(`/api/campaigns/${id}`);
export const startCampaign = (id: number) => post<Campaign>(`/api/campaigns/${id}/start`);
export const pauseCampaign = (id: number) => post<Campaign>(`/api/campaigns/${id}/pause`);
export const fetchCampaignMembers = (id: number) => get<CampaignMember[]>(`/api/campaigns/${id}/members`);
export const removeCampaignMember = (campaignId: number, memberId: number) =>
  del<{ removed: number }>(`/api/campaigns/${campaignId}/members/${memberId}`);
export const fetchCampaignSends = (id: number) => get<EmailSendRecord[]>(`/api/campaigns/${id}/sends`);
export const runCampaignTick = () => post<{ emails_processed: number }>("/api/campaigns/run-tick");

// ── Automations ─────────────────────────────────────────────────────────────
export const fetchAutomationOptions = () => get<AutomationOptions>("/api/automations/options");
export const fetchAutomations = () => get<Automation[]>("/api/automations");
export const fetchAutomation = (id: number) => get<Automation>(`/api/automations/${id}`);
export const createAutomation = (payload: Record<string, unknown>) => post<Automation>("/api/automations", payload);
export const updateAutomation = (id: number, payload: Record<string, unknown>) => put<Automation>(`/api/automations/${id}`, payload);
export const deleteAutomation = (id: number) => del<{ deleted: number }>(`/api/automations/${id}`);
export const activateAutomation = (id: number) => post<Automation>(`/api/automations/${id}/activate`);
export const pauseAutomation = (id: number) => post<Automation>(`/api/automations/${id}/pause`);
export const enrollLeads = (id: number, leadIds: number[]) =>
  post<{ enrolled: number }>(`/api/automations/${id}/enroll`, { lead_ids: leadIds });
export const testRunAutomation = (id: number) => post<{ tested_with: string }>(`/api/automations/${id}/test-run`);
export const fetchAutomationLogs = (id: number) => get<AutomationLogEntry[]>(`/api/automations/${id}/logs`);

// ── Pipeline ────────────────────────────────────────────────────────────────
export const fetchBoard = () => get<PipelineBoard>("/api/pipeline/board");
export const fetchOpportunity = (id: number) => get<OpportunityDetail>(`/api/pipeline/${id}`);
export const updateOpportunity = (id: number, payload: Record<string, unknown>) =>
  patch<OpportunityDetail["opportunity"]>(`/api/pipeline/${id}`, payload);
export const deleteOpportunity = (id: number) => del<{ deleted: number }>(`/api/pipeline/${id}`);

// ── Settings / onboarding ───────────────────────────────────────────────────
export const fetchSettings = () => get<AppSettings>("/api/settings");
export const updateSettings = (values: Record<string, string>, secrets: Record<string, string> = {}) =>
  put<{ ok: boolean }>("/api/settings", { values, secrets });
export const completeOnboarding = (payload: Record<string, unknown>) => post<{ ok: boolean }>("/api/settings/onboarding", payload);
export const fetchHealth = () => get<{ ok: boolean; disclaimer: string }>("/api/health");

// ── Auth ────────────────────────────────────────────────────────────────────
export interface AuthStatus {
  account_exists: boolean;
  onboarded: boolean;
}

export const fetchAuthStatus = () => get<AuthStatus>("/api/auth/status");

export async function login(email: string, password: string): Promise<string> {
  const result = await post<{ token: string; email: string }>("/api/auth/login", { email, password });
  setToken(result.token);
  return result.email;
}

export async function register(email: string, password: string): Promise<{ email: string; recovery_key: string }> {
  const result = await post<{ token: string; email: string; recovery_key: string }>("/api/auth/register", { email, password });
  setToken(result.token);
  return { email: result.email, recovery_key: result.recovery_key };
}

export async function recoverAccount(email: string, recoveryKey: string, newPassword: string): Promise<{ email: string; recovery_key: string }> {
  const result = await post<{ token: string; email: string; recovery_key: string }>("/api/auth/recover", {
    email,
    recovery_key: recoveryKey,
    new_password: newPassword,
  });
  setToken(result.token);
  return { email: result.email, recovery_key: result.recovery_key };
}

export async function logout(): Promise<void> {
  try {
    await post<{ ok: boolean }>("/api/auth/logout");
  } finally {
    setToken(null);
  }
}

export const fetchMe = () => get<{ email: string }>("/api/auth/me");
