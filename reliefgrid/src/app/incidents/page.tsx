"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Select } from "@/components/ui";

const SEVERITY_BADGE: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700",
};
const STATUS_BADGE: Record<string, string> = {
  REPORTED: "bg-slate-100 text-slate-700",
  VERIFIED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  RESOLVED: "bg-green-100 text-green-700",
};

export default function IncidentsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", category: "", severity: "", status: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.category) params.set("category", filters.category);
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.status) params.set("status", filters.status);
    const d = await apiFetch(`/api/incidents?${params}`);
    setData(d.data);
    setLoading(false);
  }

  const categories = ["FLOOD", "CYCLONE", "EARTHQUAKE", "FIRE", "LANDSLIDE", "INFRASTRUCTURE_FAILURE"];
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const statuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED"];

  if (loading) return <div className="text-slate-500 py-10">Loading incidents...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incident Management</h1>
          <p className="text-slate-500 text-sm">Track and coordinate emergency incidents</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(user?.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/incidents/create")}>
            Report Incident
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input placeholder="Search incidents..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{statusLabel(c)}</option>)}
        </Select>
        <Select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
          <option value="">All Severities</option>
          {severities.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Title</th>
              <th className="p-3 font-semibold text-slate-600">Category</th>
              <th className="p-3 font-semibold text-slate-600">Location</th>
              <th className="p-3 font-semibold text-slate-600">Severity</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600">Affected</th>
              <th className="p-3 font-semibold text-slate-600">Priority</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-slate-500">No incidents found.</td></tr>
            ) : (
              data.map((i: any) => (
                <tr key={i.id} className="hover:bg-slate-50 border-b border-slate-100 group">
                  <td className="p-3 font-medium text-slate-900">{i.title}</td>
                  <td className="p-3 text-slate-600">{statusLabel(i.category)}</td>
                  <td className="p-3 text-slate-600">{i.location}</td>
                  <td className="p-3"><Badge className={SEVERITY_BADGE[i.severity] || ""}>{statusLabel(i.severity)}</Badge></td>
                  <td className="p-3"><Badge className={STATUS_BADGE[i.status] || ""}>{statusLabel(i.status)}</Badge></td>
                  <td className="p-3 text-slate-600">{i.affectedPopulation.toLocaleString()}</td>
                  <td className="p-3 text-slate-600 font-medium">{i.priorityScore}</td>
                  <td className="p-3 text-right">
                    <a href={`/incidents/${i.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
