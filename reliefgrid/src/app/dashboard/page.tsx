"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import Link from "next/link";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, ResponsiveContainer, Cell,
} from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#3b82f6", "#10b981", "#ef4444"];

type DashboardStats = {
  activeIncidents: number;
  totalAffected: number;
  pendingRequests: number;
  availableResources: number;
  activeShelters: number;
  volunteerAvailability: number;
  avgResponseTime: number | null;
  categoryDist: { category: string; _count: number }[];
  requestTrends: { createdAt: string; _count: number }[];
  resourceDist: { category: string; _sum: { availableQuantity: number | null } }[];
  demoCounts: {
    requests: number;
    resources: number;
    shelters: number;
    volunteers: number;
    teams: number;
    tasks: number;
    allocations: number;
  };
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const user = session?.user as { role?: string; organizationId?: string | null } | undefined;
  const role = user?.role;

  useEffect(() => {
    let active = true;
    async function load(showLoading: boolean) {
      if (showLoading && active) setLoading(true);
      try {
        const result = await apiFetch("/api/analytics");
        if (active) {
          setStats(result);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load(true);
    const timer = window.setInterval(() => load(false), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading dashboard...</p>
      </div>
    </div>
  );

  if (error && !stats) return (
    <div role="alert" className="space-y-3 text-rose-700">
      <p>Unable to load dashboard data. Please try again.</p>
      <button className="rounded border border-rose-300 px-3 py-2 text-sm" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const cats = stats?.categoryDist || [];
  const trends = stats?.requestTrends || [];
  const resDist = stats?.resourceDist || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Emergency Dashboard</h1>
          <p className="text-slate-500 text-sm">Operational overview for {role ? ROLE_LABEL[role] || role : "your role"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Incidents" value={stats?.activeIncidents ?? 0} color="bg-rose-500" icon="▲" />
        <StatCard title="Total Affected People" value={stats?.totalAffected ?? 0} color="bg-orange-500" icon="👥" />
        <StatCard title="Pending Requests" value={stats?.pendingRequests ?? 0} color="bg-amber-500" icon="📋" />
        <StatCard title="Available Resources" value={stats?.availableResources ?? 0} color="bg-emerald-500" icon="📦" />
        <StatCard title="Active Shelters" value={stats?.activeShelters ?? 0} color="bg-blue-500" icon="🏠" />
        <StatCard title="Available Volunteers" value={stats?.volunteerAvailability ?? 0} color="bg-indigo-500" icon="👷" />
        <StatCard
          title="Average Response Time"
          value={stats?.avgResponseTime === null ? "No data" : stats?.avgResponseTime ?? 0}
          color="bg-cyan-600"
          icon="⏱"
          suffix={stats?.avgResponseTime === null ? undefined : "min"}
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Shared sample dataset</h2>
          <p className="text-sm text-slate-500">Read-only sample records are available to every signed-in role.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <DemoCountCard title="Requests" count={stats?.demoCounts.requests ?? 0} href="/requests" />
          <DemoCountCard title="Resources" count={stats?.demoCounts.resources ?? 0} href="/resources" />
          <DemoCountCard title="Shelters" count={stats?.demoCounts.shelters ?? 0} href="/shelters" />
          <DemoCountCard title="Volunteers" count={stats?.demoCounts.volunteers ?? 0} href="/volunteers" />
          <DemoCountCard title="Teams" count={stats?.demoCounts.teams ?? 0} href="/teams" />
          <DemoCountCard title="Tasks" count={stats?.demoCounts.tasks ?? 0} href="/tasks" />
          <DemoCountCard title="Allocations" count={stats?.demoCounts.allocations ?? 0} href="/allocations" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Incident Category Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            {cats.length === 0 ? <p className="text-sm text-slate-500">No incidents to display yet.</p> : <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cats.map((c, i) => ({ name: statusLabel(c.category), value: c._count, fill: COLORS[i % COLORS.length] }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {cats.map((c, i) => <Cell key={c.category} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resource Distribution by Category</CardTitle></CardHeader>
          <CardContent className="h-64">
            {resDist.length === 0 ? <p className="text-sm text-slate-500">No resources to display yet.</p> : <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resDist.map((r) => ({ name: statusLabel(r.category), value: r._sum?.availableQuantity ?? 0 }))}>
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Emergency Request Trends</CardTitle></CardHeader>
        <CardContent className="h-64">
          {trends.length === 0 ? <p className="text-sm text-slate-500">No emergency requests to display yet.</p> : <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends.map((t) => ({ name: t.createdAt.slice(5), value: t._count }))}>
              <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>
    </div>
  );
}

function DemoCountCard({ title, count, href }: { title: string; count: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{count.toLocaleString()}</p>
    </Link>
  );
}

function StatCard({ title, value, color, icon, suffix }: { title: string; value: number | string; color: string; icon: string; suffix?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString() : value} {suffix && <span className="text-sm font-medium">{suffix}</span>}</p>
        </div>
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-lg`}>{icon}</div>
      </div>
    </Card>
  );
}

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  EMERGENCY_COORDINATOR: "Emergency Coordinator",
  RELIEF_ORGANIZATION: "Relief Organization",
  VOLUNTEER: "Volunteer",
  SHELTER_MANAGER: "Shelter Manager",
};
