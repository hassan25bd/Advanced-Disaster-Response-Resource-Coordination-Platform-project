"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";

const CAT_BADGE: Record<string, string> = {
  FOOD_PACKAGES: "bg-blue-100 text-blue-700", DRINKING_WATER: "bg-cyan-100 text-cyan-700", MEDICAL_SUPPLIES: "bg-rose-100 text-rose-700",
  EMERGENCY_KITS: "bg-indigo-100 text-indigo-700", BLANKETS: "bg-amber-100 text-amber-700", RESCUE_EQUIPMENT: "bg-orange-100 text-orange-700", TRANSPORTATION: "bg-purple-100 text-purple-700",
};

export default function ResourcesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", category: "" });
  const user = (session?.user as any) || {};

  useEffect(() => {
    load();
  }, [filters]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.category) params.set("category", filters.category);
    const d = await apiFetch(`/api/resources?${params}`);
    setData(d.data);
    setLoading(false);
  }

  const categories = ["FOOD_PACKAGES", "DRINKING_WATER", "MEDICAL_SUPPLIES", "EMERGENCY_KITS", "BLANKETS", "RESCUE_EQUIPMENT", "TRANSPORTATION"];

  if (loading) return <div className="py-10 text-center">Loading resources...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resource Management</h1>
          <p className="text-slate-500 text-sm">Track emergency relief inventory and stock</p>
        </div>
        {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(user?.role) && (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => location.assign("/resources/create")}>
            Register Resource
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input placeholder="Search resources..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{statusLabel(c)}</option>)}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 font-semibold text-slate-600">Resource</th>
              <th className="p-3 font-semibold text-slate-600">Category</th>
              <th className="p-3 font-semibold text-slate-600">Organization</th>
              <th className="p-3 font-semibold text-slate-600">Total</th>
              <th className="p-3 font-semibold text-slate-600">Available</th>
              <th className="p-3 font-semibold text-slate-600">Unit</th>
              <th className="p-3 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-slate-500">No resources found.</td></tr>
            ) : (
              data.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="p-3 font-medium text-slate-900">{r.name}</td>
                  <td className="p-3"><BadgeInline className={CAT_BADGE[r.category] || ""}>{statusLabel(r.category)}</BadgeInline></td>
                  <td className="p-3 text-slate-600">{r.organization?.name || "—"}</td>
                  <td className="p-3 text-slate-600">{r.totalQuantity}</td>
                  <td className="p-3 font-medium">{r.availableQuantity <= 0 ? <span className="text-rose-600">{r.availableQuantity}</span> : r.availableQuantity}</td>
                  <td className="p-3 text-slate-600">{r.unit}</td>
                  <td className="p-3 text-right"><a href={`/resources/${r.id}`} className="text-rose-600 text-sm font-medium hover:underline">View</a></td>
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
