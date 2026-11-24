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
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: "", type: "", priority: "", status: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page) });
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.status) params.set("status", filters.status);
      try {
        const result = await apiFetch(`/api/requests?${params}`);
        if (active) {
          setData(result.data);
          setTotal(result.total);
        }
      } catch {
        if (active) setError("Unable to load requests. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [filters, page]);

  const types = ["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORTATION"];
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const statuses = ["PENDING", "VERIFIED", "ALLOCATED", "IN_TRANSIT", "COMPLETED", "REJECTED"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Emergency Requests</h1>
          <p className="text-slate-500 text-sm">Manage assistance requests from affected communities</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(user.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/requests/create")}>
            New Request
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input placeholder="Search requests..." value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} />
        <Select value={filters.type} onChange={(e) => { setPage(1); setFilters({ ...filters, type: e.target.value }); }}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}
        </Select>
        <Select value={filters.priority} onChange={(e) => { setPage(1); setFilters({ ...filters, priority: e.target.value }); }}>
          <option value="">All Priorities</option>
          {priorities.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
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
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">Loading requests...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} role="alert" className="p-4 text-center text-rose-700">{error}</td></tr>
            ) : data.length === 0 ? (
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
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>Page {page} of {Math.max(1, Math.ceil(total / 10))} ({total} requests)</span>
        <div className="flex gap-2">
          <Button disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button disabled={loading || page * 10 >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function BadgeInline({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className || ""}`}>{children}</span>;
}
