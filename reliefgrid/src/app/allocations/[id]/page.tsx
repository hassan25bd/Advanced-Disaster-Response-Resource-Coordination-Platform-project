"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type Allocation = {
  id: string; isDemo?: boolean; allocatedQuantity: number; status: string; qrVerificationCode: string; allocatedAt: string; deliveredAt: string | null;
  request: { id: string; type: string; location: string; status: string; incident?: { title: string; location: string } };
  resource: { name: string; unit: string };
  organization: { name: string };
  coordinator: { name: string };
  history: { id: string; action: string; details: string | null; timestamp: string; user: { name: string } }[];
};

export default function AllocationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [allocation, setAllocation] = useState<Allocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch(`/api/allocations/${encodeURIComponent(id)}`) as Allocation;
      setAllocation(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load allocation.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/allocations/${encodeURIComponent(id)}`).then((result: Allocation) => {
      if (active) {
        setAllocation(result);
        setError("");
      }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load allocation.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function updateStatus(status: string) {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/allocations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update distribution status.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading allocation...</p>;
  if (!allocation) return <p role="alert" className="text-rose-700">{error || "Allocation not found."}</p>;
  const terminal = allocation.status === "DELIVERED" || allocation.status === "CANCELLED";
  const canUpdate = !allocation.isDemo && (role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "RELIEF_ORGANIZATION");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Allocation details</h1><p className="text-sm text-slate-500">{allocation.request.incident?.title || "Emergency request"} · {statusLabel(allocation.status)}</p></div><Button onClick={() => router.push("/allocations")}>Back to allocations</Button></div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {allocation.isDemo && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Shared sample record · read-only</p>}
      <Card><CardHeader><CardTitle>Distribution record</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <p><strong>Request:</strong> {statusLabel(allocation.request.type)} — {allocation.request.location}</p>
        <p><strong>Incident:</strong> {allocation.request.incident?.title || "—"}</p>
        <p><strong>Resource:</strong> {allocation.resource.name}</p>
        <p><strong>Organization:</strong> {allocation.organization.name}</p>
        <p><strong>Allocated quantity:</strong> {allocation.allocatedQuantity} {allocation.resource.unit}</p>
        <p><strong>Coordinator:</strong> {allocation.coordinator.name}</p>
        <p><strong>Allocated:</strong> {new Date(allocation.allocatedAt).toLocaleString()}</p>
        <p><strong>Delivered:</strong> {allocation.deliveredAt ? new Date(allocation.deliveredAt).toLocaleString() : "Not delivered"}</p>
        <p className="sm:col-span-2"><strong>QR verification code:</strong> <code className="rounded bg-slate-100 px-2 py-1">{allocation.qrVerificationCode}</code></p>
      </CardContent></Card>
      {canUpdate && !terminal && <Card><CardHeader><CardTitle>Update distribution status</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">
        {allocation.status === "ASSIGNED" && <Button disabled={saving} onClick={() => void updateStatus("IN_TRANSIT")} className="bg-amber-600 text-white">Mark in transit</Button>}
        {allocation.status === "IN_TRANSIT" && <Button disabled={saving} onClick={() => void updateStatus("DELIVERED")} className="bg-emerald-600 text-white">Mark delivered</Button>}
        {role !== "RELIEF_ORGANIZATION" && <Button disabled={saving} onClick={() => void updateStatus("CANCELLED")}>Cancel allocation</Button>}
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Allocation history</CardTitle></CardHeader><CardContent>
        {allocation.history.length ? <ul className="space-y-2">{allocation.history.map((entry) => <li key={entry.id} className="border-b py-2 text-sm">{entry.action.replaceAll("_", " ")} · {entry.details || "Status update"} · {entry.user.name} · {new Date(entry.timestamp).toLocaleString()}</li>)}</ul> : <p className="text-sm text-slate-500">No status updates recorded.</p>}
      </CardContent></Card>
    </div>
  );
}
