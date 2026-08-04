import type { BadgeTone } from "../components/ui";

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const EMAIL_STATUS_TONE: Record<string, BadgeTone> = {
  valid: "green",
  risky: "amber",
  invalid: "red",
  not_found: "gray",
  unverified: "gray",
};

export const QUALIFICATION_TONE: Record<string, BadgeTone> = {
  qualified: "green",
  rejected: "red",
  pending: "gray",
};

export const REVIEW_TONE: Record<string, BadgeTone> = {
  approved: "green",
  rejected: "red",
  new: "blue",
};

export const SOURCE_TONE: Record<string, BadgeTone> = {
  engine: "green",
  inbound: "blue",
  manual: "gray",
  api: "violet",
};

export const RUN_STATUS_TONE: Record<string, BadgeTone> = {
  running: "blue",
  queued: "gray",
  completed: "green",
  failed: "red",
  cancelled: "amber",
};

export const CAMPAIGN_STATUS_TONE: Record<string, BadgeTone> = {
  draft: "gray",
  running: "green",
  paused: "amber",
  completed: "blue",
};

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
