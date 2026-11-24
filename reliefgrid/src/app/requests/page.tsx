"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

const TYPE_BADGE: Record<string, string> = {
  FOOD: "bg-blue-100 text-blue-700", WATER: "bg-cyan-100 text-cyan-700", MEDICAL: "bg-rose-100 text-rose-700",
  SHELTER: "bg-indigo-100 text-indigo-700", RESCUE: "bg-orange-100 text-orange-700", TRANSPORTATION: "bg-purple-100 text-purple-700",
};
const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700", VERIFIED: "bg-blue-100 text-blue-700", ALLOCATED: "bg-indigo-100 text-indigo-700",
  IN_TRANSIT: "bg-amber-100 text-amber-700", COMPLETED: "bg-green-100 text-green-700", REJECTED: "bg-rose-100 text-rose-700",
};

export default function RequestsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", type: "", priority: "", status: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.status) params.set("status", filters.status);
    const d = await apiFetch(`/api/requests?${params}`);
    setData(d.data);
    setLoading(false);
  }

  const types = ["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORTATION"];
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const statuses = ["PENDING", "VERIFIED", "ALLOCATED", "IN_TRANSIT", "COMPLETED", "REJECTED"];

  if (loading) return <div className="py-10 text-center">Loading requests...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Emergency Requests</h1>
          <p className="text-slate-500 text-sm">Manage assistance requests from affected communities</p>
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/requests/create")}>
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input placeholder="Search requests..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}
        </Select>
        <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">All Priorities</option>
          {priorities.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
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
              <th className="p-3 font-semibold text-slate-600">Request</th>
              <th className="p-3 font-semibold text-slate-600">Type</th>
              <th className="p-3 font-semibold text-slate-600">Location</th>
              <th className="p-3 font-semibold text-slate-600">Priority</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600">Affected</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No requests found.</td></tr>
            ) : (
              data.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{r.incident?.title || "Unknown Incident"}</td>
                  <td className="p-3"><BadgeInline className={TYPE_BADGE[r.type] || ""}>{statusLabel(r.type)}</BadgeInline></td>
                  <td className="p-3 text-slate-600">{r.location}</td>
                  <td className="p-3"><BadgeInline className={r.priority === "CRITICAL" ? "bg-rose-100 text-rose-700" : r.priority === "HIGH" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"}>{statusLabel(r.priority)}</BadgeInline></td>
                  <td className="p-3"><BadgeInline className={STATUS_BADGE[r.status] || ""}>{statusLabel(r.status)}</BadgeInline></td>
                  <td className="p-3 text-slate-600">{r.affectedPeople}</td>
                  <td className="p-3 text-right"><a href={`/requests/${r.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BadgeInline({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className || ""}`}>{children}</span>;
}
