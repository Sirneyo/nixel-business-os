/**
 * Shared UI kit — every page builds from these primitives so the whole app
 * stays visually consistent and is easy to re-theme from one place.
 */

import type { LucideIcon } from "lucide-react";
import { Loader2, Search, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// ── Layout ──────────────────────────────────────────────────────────────────

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`absolute inset-0 overflow-y-auto p-4 sm:p-6 lg:p-8 ${className}`}>{children}</div>;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
            <Icon size={22} strokeWidth={2.2} />
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-ink-200/70 bg-white shadow-card ${className}`}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
        <Icon size={24} />
      </div>
      <p className="font-medium text-ink-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-ink-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-card",
  secondary: "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 shadow-card",
  ghost: "text-ink-600 hover:bg-ink-100",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-card",
  dark: "bg-ink-900 text-white hover:bg-ink-800 shadow-card",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; loading?: boolean }) {
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_STYLES[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

export type BadgeTone = "green" | "red" | "amber" | "blue" | "gray" | "violet";

const BADGE_STYLES: Record<BadgeTone, string> = {
  green: "bg-brand-50 text-brand-700 ring-brand-600/20",
  red: "bg-danger-50 text-danger-700 ring-danger-600/20",
  amber: "bg-warn-50 text-warn-700 ring-warn-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  gray: "bg-ink-100 text-ink-600 ring-ink-500/20",
  violet: "bg-accent-50 text-accent-700 ring-accent-600/20",
};

export function Badge({ tone = "gray", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE_STYLES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function SampleBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <Badge tone="violet">Sample</Badge>;
}

// ── Forms ───────────────────────────────────────────────────────────────────

const FIELD_CLASS =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLASS} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input className={`${FIELD_CLASS} pl-9`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </Card>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap border-b border-ink-200 bg-ink-50/80 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-500 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "", colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`border-b border-ink-100 px-4 py-3 align-middle text-ink-700 ${className}`}>
      {children}
    </td>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
      <span>
        Page {page + 1} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={`max-h-[88vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} animate-fade-up overflow-y-auto rounded-2xl bg-white p-6 shadow-pop`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, tone = "brand" }: { icon: LucideIcon; label: string; value: ReactNode; tone?: "brand" | "ink" | "violet" | "amber" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    ink: "bg-ink-100 text-ink-600",
    violet: "bg-accent-50 text-accent-600",
    amber: "bg-warn-50 text-warn-600",
  };
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="font-display text-xl font-bold text-ink-900">{value}</p>
      </div>
    </Card>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{message}</p>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-400">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
