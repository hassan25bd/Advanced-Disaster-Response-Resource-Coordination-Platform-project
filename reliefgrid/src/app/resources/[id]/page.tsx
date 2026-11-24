"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

type ResourceDetails = {
  id: string;
  isDemo?: boolean;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  storageLocation: string;
  organization?: { name: string };
  stockHistory: { id: string; type: string; changeAmount: number; notes: string | null; timestamp: string }[];
  allocations: { id: string; status: string; allocatedQuantity: number }[];
};

export default function ResourceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [resource, setResource] = useState<ResourceDetails | null>(null);
  const [form, setForm] = useState({ name: "", totalQuantity: "", availableQuantity: "", unit: "", storageLocation: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch(`/api/resources/${encodeURIComponent(id)}`) as ResourceDetails;
      setResource(result);
      setForm({
        name: result.name,
        totalQuantity: String(result.totalQuantity),
        availableQuantity: String(result.availableQuantity),
        unit: result.unit,
        storageLocation: result.storageLocation,
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load resource.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/resources/${encodeURIComponent(id)}`).then((result: ResourceDetails) => {
      if (!active) return;
      setResource(result);
      setForm({
        name: result.name,
        totalQuantity: String(result.totalQuantity),
        availableQuantity: String(result.availableQuantity),
        unit: result.unit,
        storageLocation: result.storageLocation,
      });
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load resource.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/resources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          totalQuantity: Number(form.totalQuantity),
          availableQuantity: Number(form.availableQuantity),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update resource.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading resource...</p>;
  if (!resource) return <p role="alert" className="text-rose-700">{error || "Resource not found."}</p>;
  const canEdit = !resource.isDemo && ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(role || "");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{resource.name}</h1><p className="text-sm text-slate-500">{resource.organization?.name} · {statusLabel(resource.category)}</p></div>
        <Button onClick={() => router.push("/resources")}>Back to resources</Button>
      </div>
      {resource.isDemo && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Shared sample record · read-only</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
        <CardContent>
          {canEdit ? <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="text-sm font-medium">Storage location<Input required value={form.storageLocation} onChange={(event) => setForm({ ...form, storageLocation: event.target.value })} /></label>
            <label className="text-sm font-medium">Total quantity<Input type="number" min="0" step="1" required value={form.totalQuantity} onChange={(event) => setForm({ ...form, totalQuantity: event.target.value })} /></label>
            <label className="text-sm font-medium">Available quantity<Input type="number" min="0" step="1" required value={form.availableQuantity} onChange={(event) => setForm({ ...form, availableQuantity: event.target.value })} /></label>
            <label className="text-sm font-medium">Unit<Input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
            <div className="flex items-end"><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Update inventory"}</Button></div>
          </form> : <p>{resource.availableQuantity} / {resource.totalQuantity} {resource.unit} available · Stored at {resource.storageLocation}</p>}
          <p className="mt-4 text-sm text-slate-500">Available: {resource.availableQuantity} / {resource.totalQuantity} {resource.unit}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Stock history</CardTitle></CardHeader>
        <CardContent>
          {resource.stockHistory.length ? <ul className="space-y-2">{resource.stockHistory.map((entry) => <li key={entry.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{statusLabel(entry.type)} · {entry.notes || "Stock update"}</span><span className={entry.changeAmount < 0 ? "text-rose-700" : "text-emerald-700"}>{entry.changeAmount > 0 ? "+" : ""}{entry.changeAmount} · {new Date(entry.timestamp).toLocaleDateString()}</span></li>)}</ul> : <p className="text-sm text-slate-500">No stock history recorded.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Allocation history</CardTitle></CardHeader>
        <CardContent>
          {resource.allocations.length ? <ul className="space-y-2">{resource.allocations.map((allocation) => <li key={allocation.id} className="border-b py-2 text-sm">{allocation.allocatedQuantity} · {statusLabel(allocation.status)}</li>)}</ul> : <p className="text-sm text-slate-500">No allocations recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
