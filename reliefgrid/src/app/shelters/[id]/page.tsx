"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type OccupancyEntry = { id: string; previousOccupancy: number; newOccupancy: number; notes: string | null; timestamp: string };
type Shelter = {
  id: string; isDemo?: boolean; name: string; location: string; latitude: number; longitude: number;
  totalCapacity: number; currentOccupancy: number; status: string; facilities: string[];
  manager?: { name: string } | null; occupancyLogs: OccupancyEntry[];
};

export default function ShelterDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [form, setForm] = useState({ name: "", location: "", totalCapacity: "", currentOccupancy: "", status: "OPEN", facilities: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch(`/api/shelters/${encodeURIComponent(id)}`) as Shelter;
      setShelter(result);
      setForm({
        name: result.name,
        location: result.location,
        totalCapacity: String(result.totalCapacity),
        currentOccupancy: String(result.currentOccupancy),
        status: result.status,
        facilities: result.facilities.join(", "),
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load shelter.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/shelters/${encodeURIComponent(id)}`).then((result: Shelter) => {
      if (!active) return;
      setShelter(result);
      setForm({
        name: result.name,
        location: result.location,
        totalCapacity: String(result.totalCapacity),
        currentOccupancy: String(result.currentOccupancy),
        status: result.status,
        facilities: result.facilities.join(", "),
      });
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load shelter.");
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
      await apiFetch(`/api/shelters/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          totalCapacity: Number(form.totalCapacity),
          currentOccupancy: Number(form.currentOccupancy),
          facilities: form.facilities.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update shelter.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading shelter...</p>;
  if (!shelter) return <p role="alert" className="text-rose-700">{error || "Shelter not found."}</p>;
  const canEdit = !shelter.isDemo && (role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "SHELTER_MANAGER");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{shelter.name}</h1><p className="text-sm text-slate-500">{shelter.location} · Manager: {shelter.manager?.name || "Unassigned"}</p></div>
        <Button onClick={() => router.push("/shelters")}>Back to shelters</Button>
      </div>
      {shelter.isDemo && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Shared sample record · read-only</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Capacity and facilities</CardTitle></CardHeader><CardContent>
        {canEdit ? <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="text-sm font-medium">Location<Input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label className="text-sm font-medium">Total capacity<Input required type="number" min="0" step="1" value={form.totalCapacity} onChange={(event) => setForm({ ...form, totalCapacity: event.target.value })} /></label>
          <label className="text-sm font-medium">Current occupancy<Input required type="number" min="0" step="1" value={form.currentOccupancy} onChange={(event) => setForm({ ...form, currentOccupancy: event.target.value })} /></label>
          <label className="text-sm font-medium">Status<Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["OPEN", "FULL", "CLOSED", "MAINTENANCE"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>
          <label className="text-sm font-medium">Facilities<Input value={form.facilities} onChange={(event) => setForm({ ...form, facilities: event.target.value })} /></label>
          <p className="self-center text-sm text-slate-600">Available capacity: {shelter.totalCapacity - shelter.currentOccupancy}</p>
          <div><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Save shelter"}</Button></div>
        </form> : <p>{shelter.currentOccupancy} / {shelter.totalCapacity} occupied · {shelter.totalCapacity - shelter.currentOccupancy} available</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Occupancy history</CardTitle></CardHeader><CardContent>
        {shelter.occupancyLogs.length ? <ul className="space-y-2">{shelter.occupancyLogs.map((entry) => <li key={entry.id} className="border-b py-2 text-sm">{entry.previousOccupancy} → {entry.newOccupancy} · {entry.notes || "Occupancy update"} · {new Date(entry.timestamp).toLocaleString()}</li>)}</ul> : <p className="text-sm text-slate-500">No occupancy updates recorded.</p>}
      </CardContent></Card>
    </div>
  );
}
