import {
  Blocks,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  Radar,
  Send,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";

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

export default function Sidebar({ demoMode }: { demoMode: boolean }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-200/70 bg-white">
      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
          <Blocks size={20} strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">Nixel Business OS</p>
          <p className="text-[11px] font-medium text-ink-400">Starter Edition</p>
        </div>
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
        {demoMode && (
          <div className="mb-2 rounded-lg bg-warn-50 px-2.5 py-1.5 text-[11px] font-semibold text-warn-700">
            Demo Mode — providers simulated
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-ink-400">
          Built on the Nixel platform.
          <br />
          Connect · Optimise · Grow
        </p>
      </div>
    </aside>
  );
}
