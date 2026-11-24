"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700", FULL: "bg-rose-100 text-rose-700", CLOSED: "bg-slate-100 text-slate-700", MAINTENANCE: "bg-amber-100 text-amber-700",
};

export default function SheltersPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters, page]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    try {
      const d = await apiFetch(`/api/shelters?${params}`);
      setData(d.data);
      setTotal(d.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load shelters.");
    } finally {
      setLoading(false);
    }
  }

  const statuses = ["OPEN", "FULL", "CLOSED", "MAINTENANCE"];

  if (loading) return <div className="py-10 text-center">Loading shelters...</div>;
  if (error) return <div role="alert" className="space-y-3 text-rose-700"><p>Unable to load shelters: {error}</p><Button onClick={() => void load()}>Retry</Button></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shelter Management</h1>
          <p className="text-slate-500 text-sm">Manage emergency shelter capacity and occupancy</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "SHELTER_MANAGER"].includes(user?.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/shelters/create")}>
            Register Shelter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Search shelters..." value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} />
        <Select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} shelters` : "No shelters"}</span>
        <div className="flex gap-2"><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Shelter</th>
              <th className="p-3 font-semibold text-slate-600">Location</th>
              <th className="p-3 font-semibold text-slate-600">Capacity</th>
              <th className="p-3 font-semibold text-slate-600">Occupancy</th>
              <th className="p-3 font-semibold text-slate-600">Available</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No shelters found.</td></tr>
            ) : (
              data.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{s.name}</td>
                  <td className="p-3 text-slate-600">{s.location}</td>
                  <td className="p-3 text-slate-600">{s.totalCapacity}</td>
                  <td className="p-3 font-medium">{s.currentOccupancy}</td>
                  <td className="p-3 text-slate-600">{s.totalCapacity - s.currentOccupancy}</td>
                  <td className="p-3"><BadgeInline className={STATUS_BADGE[s.status] || ""}>{statusLabel(s.status)}</BadgeInline></td>
                  <td className="p-3 text-right"><a href={`/shelters/${s.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a></td>
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
