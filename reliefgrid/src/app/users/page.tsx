"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

type UserRow = {
  id: string; name: string; email: string; role: string; organization: { name: string } | null; isActive: boolean;
};
const ROLE_BADGE: Record<string, string> = {
  SYSTEM_ADMIN: "bg-rose-100 text-rose-700", EMERGENCY_COORDINATOR: "bg-indigo-100 text-indigo-700",
  RELIEF_ORGANIZATION: "bg-blue-100 text-blue-700", VOLUNTEER: "bg-green-100 text-green-700", SHELTER_MANAGER: "bg-amber-100 text-amber-700",
};

export default function UsersPage() {
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const pageSize = 20;

  const fetchPage = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filters.search) params.set("search", filters.search);
    if (filters.role) params.set("role", filters.role);
    return apiFetch(`/api/users?${params}`);
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    fetchPage().then((d) => {
      if (!active) return;
      setData(d.data);
      setTotal(d.total);
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load users.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPage, retryCount]);

  const roles = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"];

  if (loading) return <div className="py-10 text-center">Loading users...</div>;
  if (error) return <div role="alert" className="space-y-3 text-rose-700"><p>Unable to load users: {error}</p><Button onClick={() => { setLoading(true); setRetryCount((count) => count + 1); }}>Retry</Button></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm">Manage platform users and permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Search users..." value={filters.search} onChange={(e) => { setPage(1); setFilters({ ...filters, search: e.target.value }); }} />
        <Select value={filters.role} onChange={(e) => { setPage(1); setFilters({ ...filters, role: e.target.value }); }}>
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} users` : "No users"}</span>
        <div className="flex gap-2"><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button disabled={page * pageSize >= total} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Name</th>
              <th className="p-3 font-semibold text-slate-600">Email</th>
              <th className="p-3 font-semibold text-slate-600">Role</th>
              <th className="p-3 font-semibold text-slate-600">Organization</th>
              <th className="p-3 font-semibold text-slate-600">Status</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No users found.</td></tr>
            ) : (
              data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{u.name}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3"><BadgeInline className={ROLE_BADGE[u.role] || ""}>{statusLabel(u.role)}</BadgeInline></td>
                  <td className="p-3 text-slate-600">{u.organization?.name || "—"}</td>
                  <td className="p-3"><BadgeInline className={u.isActive ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-700"}>{u.isActive ? "Active" : "Inactive"}</BadgeInline></td>
                  <td className="p-3 text-right"><a href={`/users/${u.id}`} className="text-rose-600 text-sm font-medium hover:underline">Profile</a></td>
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
