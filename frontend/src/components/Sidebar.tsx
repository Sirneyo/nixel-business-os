import {
  Blocks,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Mail,
  Plug,
  Radar,
  Send,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { NIXEL_CONTACT_URL, NIXEL_WEBSITE_URL } from "../lib/brand";
import type { AppSettings } from "../types";

const GROUPS: { label: string; items: { to: string; label: string; icon: typeof Radar }[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Lead Generation",
    items: [
      { to: "/engine", label: "Lead Engine", icon: Radar },
      { to: "/leads", label: "Lead Workspace", icon: Users },
      { to: "/inbound", label: "Inbound Leads", icon: Inbox },
    ],
  },
  {
    label: "Outreach",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: Send },
      { to: "/emails", label: "Email Builder", icon: Mail },
      { to: "/automations", label: "Automations", icon: Workflow },
    ],
  },
  {
    label: "Sales",
    items: [{ to: "/pipeline", label: "Pipeline", icon: KanbanSquare }],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export default function Sidebar({
  businessName,
  settings,
  open,
  onClose,
  onLogout,
}: {
  businessName: string;
  settings: AppSettings | null;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const providers = settings?.providers;
  const needsSetup =
    providers != null && !(providers.lead_search.configured && providers.email_sender.configured);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-ink-200/70 bg-white transition-transform duration-200 lg:static lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
            <Blocks size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-ink-900">
              {businessName || "Nixel Business OS"}
            </p>
            <p className="text-[11px] font-medium text-ink-400">{businessName ? "Powered by Nixel" : "Starter Edition"}</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            className="ml-auto rounded-lg p-1.5 text-ink-500 hover:bg-ink-50 lg:hidden"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">{group.label}</p>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                    }`
                  }
                >
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 px-5 py-4">
          {needsSetup && (
            <NavLink
              to="/settings"
              onClick={onClose}
              className="mb-3 flex items-center gap-2 rounded-lg bg-warn-50 px-2.5 py-2 text-[11px] font-semibold text-warn-700 hover:bg-warn-50/70"
            >
              <Plug size={13} className="shrink-0" />
              Finish setup — connect your services in Settings
            </NavLink>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="mb-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <LogOut size={16} strokeWidth={2} />
            Sign out
          </button>
          <p className="text-[11px] leading-relaxed text-ink-400">
            <a
              href={NIXEL_WEBSITE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink-500 transition-colors hover:text-brand-600"
            >
              Nixel™
            </a>{" "}
            — Connect · Optimise · Grow
            <br />
            <a
              href={NIXEL_CONTACT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-600 hover:underline"
            >
              Contact us
            </a>{" "}
            for help or feedback.
          </p>
        </div>
      </aside>
    </>
  );
}
