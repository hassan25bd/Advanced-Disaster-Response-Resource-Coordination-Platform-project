"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { BarChart, Bar, PieChart, Pie, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#ec4899", "#f59e0b", "#3b82f6", "#10b981", "#ef4444"];

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/analytics").then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm">Operational analytics and export</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Incident Category Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(stats?.categoryDist || []).map((c: any, i: number) => ({ name: statusLabel(c.category), value: c._count, fill: COLORS[i % COLORS.length] }))}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label
                >
                  {(stats?.categoryDist || []).map((c: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resource Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(stats?.resourceDist || []).map((r: any, i: number) => ({ name: statusLabel(r.category), value: r._sum?.availableQuantity ?? 0 }))}>
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Export Data</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Export platform data for offline review.</p>
            <Button className="w-full" onClick={() => alert("CSV export initiated")}>Export Incidents (CSV)</Button>
            <Button className="w-full" onClick={() => alert("CSV export initiated")}>Export Requests (CSV)</Button>
            <Button className="w-full" onClick={() => alert("PDF report generated")}>Generate PDF Report</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-2 md:col-span-1">
          <CardHeader><CardTitle>Key Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="Active Incidents" value={stats?.activeIncidents ?? 0} />
            <MetricRow label="Total Affected People" value={stats?.totalAffected ?? 0} />
            <MetricRow label="Pending Requests" value={stats?.pendingRequests ?? 0} />
            <MetricRow label="Available Resources" value={stats?.availableResources ?? 0} />
            <MetricRow label="Active Shelters" value={stats?.activeShelters ?? 0} />
            <MetricRow label="Available Volunteers" value={stats?.volunteerAvailability ?? 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value.toLocaleString()}</span>
    </div>
  );
}
