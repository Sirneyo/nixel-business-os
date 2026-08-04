import {
  Activity,
  CheckCircle2,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Radar,
  Send,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchDashboard } from "../api/client";
import { Card, ErrorNote, PageContainer, PageHeader, Spinner, StatCard } from "../components/ui";
import { timeAgo } from "../lib/format";
import type { DashboardData } from "../types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <PageContainer>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="A live picture of your lead generation, outreach and pipeline. Start with the Lead Engine to watch the system find and qualify prospects in real time."
      />
      <ErrorNote message={error} />
      {!data && !error && <Spinner />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={Users} label="Total leads" value={data.kpis.total_leads} />
            <StatCard icon={CheckCircle2} label="Qualified" value={data.kpis.qualified_leads} />
            <StatCard icon={Mail} label="Verified emails" value={data.kpis.verified_emails} />
            <StatCard icon={Inbox} label="Inbound leads" value={data.kpis.inbound_leads} tone="violet" />
            <StatCard icon={Send} label="Emails sent" value={data.kpis.emails_sent} tone="ink" />
            <StatCard icon={MessageSquare} label="Replies" value={data.kpis.replies} />
            <StatCard icon={Radar} label="Running campaigns" value={data.kpis.running_campaigns} tone="amber" />
            <StatCard icon={Workflow} label="Active automations" value={data.kpis.active_automations} tone="violet" />
            <StatCard icon={KanbanSquare} label="Open opportunities" value={data.kpis.open_opportunities} tone="ink" />
            <StatCard icon={Trophy} label="Won deals" value={data.kpis.won_deals} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Activity size={17} className="text-brand-600" />
                <h2 className="font-display text-base font-bold text-ink-900">Recent activity</h2>
              </div>
              {data.activity.length === 0 && <p className="text-sm text-ink-400">Nothing yet — run the Lead Engine to get started.</p>}
              <ul className="space-y-2.5">
                {data.activity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span className="flex-1 text-ink-700">{item.message}</span>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(item.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white">
                <Radar size={22} className="mb-3 opacity-90" />
                <h3 className="font-display text-base font-bold">Generate leads now</h3>
                <p className="mt-1 text-sm text-brand-50/90">
                  Describe your ideal customer and watch the engine search, research, verify and qualify — live.
                </p>
                <Link
                  to="/engine"
                  className="mt-4 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-card transition hover:bg-brand-50"
                >
                  Open the Lead Engine
                </Link>
              </Card>

              {data.last_run && (
                <Card className="p-5">
                  <h3 className="mb-2 font-display text-sm font-bold text-ink-900">Last engine run</h3>
                  <p className="text-sm text-ink-600">
                    Run #{data.last_run.id} · {data.last_run.status} · {data.last_run.saved} leads saved
                  </p>
                  <p className="mt-1 text-xs text-ink-400">{timeAgo(data.last_run.created_at)}</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
