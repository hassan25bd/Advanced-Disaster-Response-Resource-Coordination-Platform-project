"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, ResponsiveContainer, Cell,
} from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#3b82f6", "#10b981", "#ef4444"];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = (session?.user as any) || {};

  useEffect(() => {
    apiFetch("/api/analytics").then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2 animate-spin">
        <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full" />
        <p className="text-slate-500 text-sm">Loading dashboard...</p>
      </div>
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
          <p className="text-slate-500 text-sm">Operational overview for {ROLE_LABEL[user.role] || user.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Incidents" value={stats?.activeIncidents ?? 0} color="bg-rose-500" icon="▲" />
        <StatCard title="Total Affected People" value={stats?.totalAffected ?? 0} color="bg-orange-500" icon="👥" />
        <StatCard title="Pending Requests" value={stats?.pendingRequests ?? 0} color="bg-amber-500" icon="📋" />
        <StatCard title="Available Resources" value={stats?.availableResources ?? 0} color="bg-emerald-500" icon="📦" />
        <StatCard title="Active Shelters" value={stats?.activeShelters ?? 0} color="bg-blue-500" icon="🏠" />
        <StatCard title="Available Volunteers" value={stats?.volunteerAvailability ?? 0} color="bg-indigo-500" icon="👷" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Incident Category Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cats.map((c: any, i: number) => ({ name: statusLabel(c.category), value: c._count, fill: COLORS[i % COLORS.length] }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {cats.map((c: any, i: number) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resource Distribution by Category</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resDist.map((r: any, i: number) => ({ name: statusLabel(r.category), value: r._sum?.availableQuantity ?? 0 }))}>
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Emergency Request Trends</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends.map((t: any, i: number) => ({ name: `Day ${i}`, value: t._count }))}>
              <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, color, icon }: { title: string; value: number; color: string; icon: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
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
