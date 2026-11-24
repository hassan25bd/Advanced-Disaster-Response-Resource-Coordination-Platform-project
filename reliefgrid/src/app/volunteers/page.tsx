"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700", BUSY: "bg-rose-100 text-rose-700", OFF_DUTY: "bg-slate-100 text-slate-700",
};

export default function VolunteersPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", availability: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.availability) params.set("availabilityStatus", filters.availability);
    const d = await apiFetch(`/api/users?role=VOLUNTEER&${params}`);
    setData(d.data);
    setLoading(false);
  }

  const statuses = ["AVAILABLE", "BUSY", "OFF_DUTY"];

  if (loading) return <div className="py-10 text-center">Loading volunteers...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Volunteer Management</h1>
          <p className="text-slate-500 text-sm">Coordinate volunteers and field teams</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Search volunteers..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Name</th>
              <th className="p-3 font-semibold text-slate-600">Email</th>
              <th className="p-3 font-semibold text-slate-600">Organization</th>
              <th className="p-3 font-semibold text-slate-600">Availability</th>
              <th className="p-3 font-semibold text-slate-600">Phone</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No volunteers found.</td></tr>
            ) : (
              data.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{v.name}</td>
                  <td className="p-3 text-slate-600">{v.email}</td>
                  <td className="p-3 text-slate-600">{v.organization?.name || "—"}</td>
                  <td className="p-3"><BadgeInline className={STATUS_BADGE[v.availabilityStatus] || ""}>{statusLabel(v.availabilityStatus)}</BadgeInline></td>
                  <td className="p-3 text-slate-600">{v.phone || "—"}</td>
                  <td className="p-3 text-right"><a href={`/users/${v.id}`} className="text-rose-600 text-sm font-medium hover:underline">Profile</a></td>
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
