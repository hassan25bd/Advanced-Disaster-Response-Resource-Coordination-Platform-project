"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input } from "@/components/ui";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700", DEPLOYED: "bg-indigo-100 text-indigo-700", STANDBY: "bg-slate-100 text-slate-700",
};

export default function TeamsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "" });
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
    try {
      const d = await apiFetch(`/api/teams?${params}`);
      setData(d.data);
      setTotal(d.total);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load teams.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="py-10 text-center">Loading teams...</div>;
  if (error) return (
    <div role="alert" className="space-y-3 text-rose-700">
      <p>Unable to load teams: {error}</p>
      <Button onClick={() => void load()}>Retry</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-500 text-sm">Organize response teams and deployments</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(user?.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/teams/create")}>
            Create Team
          </Button>
        )}
      </div>

      <div className="mb-4">
        <Input placeholder="Search teams..." value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} teams` : "No teams"}</span>
        <div className="flex gap-2"><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Team Name</th>
              <th className="p-3 font-semibold text-slate-600">Organization</th>
              <th className="p-3 font-semibold text-slate-600">Leader</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">No teams found.</td></tr>
            ) : (
              data.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{t.name}</td>
                  <td className="p-3 text-slate-600">{t.organization?.name || "—"}</td>
                  <td className="p-3 text-slate-600">{t.leader?.name || "Not assigned"}</td>
                  <td className="p-3"><BadgeInline className={STATUS_BADGE[t.status] || ""}>{statusLabel(t.status)}</BadgeInline></td>
                  <td className="p-3 text-right"><a href={`/teams/${t.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a></td>
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
