"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  ASSIGNED: "bg-indigo-100 text-indigo-700", ACCEPTED: "bg-blue-100 text-blue-700", IN_PROGRESS: "bg-amber-100 text-amber-700", COMPLETED: "bg-green-100 text-green-700",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    const d = await apiFetch(`/api/tasks?${params}`);
    setData(d.data);
    setLoading(false);
  }

  const statuses = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

  if (loading) return <div className="py-10 text-center">Loading tasks...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Volunteer Tasks</h1>
          <p className="text-slate-500 text-sm">Assign and track field tasks</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(user?.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/tasks/create")}>
            Create Task
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Search tasks..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Task</th>
              <th className="p-3 font-semibold text-slate-600">Incident</th>
              <th className="p-3 font-semibold text-slate-600">Volunteer</th>
              <th className="p-3 font-semibold text-slate-600">Team</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No tasks found.</td></tr>
            ) : (
              data.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{t.title}</td>
                  <td className="p-3 text-slate-600">{t.incident?.title || "—"}</td>
                  <td className="p-3 text-slate-600">{t.volunteer?.name || "Unassigned"}</td>
                  <td className="p-3 text-slate-600">{t.team?.name || "—"}</td>
                  <td className="p-3"><BadgeInline className={STATUS_BADGE[t.status] || ""}>{statusLabel(t.status)}</BadgeInline></td>
                  <td className="p-3 text-right"><a href={`/tasks/${t.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a></td>
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
