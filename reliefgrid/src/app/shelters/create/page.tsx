"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type Manager = { id: string; name: string; isDemo?: boolean };

export default function CreateShelterPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [managers, setManagers] = useState<Manager[]>([]);
  const [form, setForm] = useState({
    name: "", location: "", latitude: "", longitude: "", totalCapacity: "",
    facilities: "", status: "OPEN", managerId: "",
  });
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!role || role === "SHELTER_MANAGER") return;
    apiFetch("/api/users?role=SHELTER_MANAGER&pageSize=100")
      .then((result: { data: Manager[] }) => setManagers(result.data.filter((manager) => !manager.isDemo)))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load shelter managers."))
      .finally(() => setLoadingManagers(false));
  }, [role]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/shelters", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude || 0),
          longitude: Number(form.longitude || 0),
          totalCapacity: Number(form.totalCapacity),
          facilities: form.facilities.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      router.push("/shelters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register shelter.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Register Shelter</h1>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Shelter details</CardTitle></CardHeader><CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="block text-sm font-medium">Location<Input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Latitude<Input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label>
            <label className="block text-sm font-medium">Longitude<Input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label>
            <label className="block text-sm font-medium">Total capacity<Input required type="number" min="0" step="1" value={form.totalCapacity} onChange={(event) => setForm({ ...form, totalCapacity: event.target.value })} /></label>
            <label className="block text-sm font-medium">Status
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {["OPEN", "FULL", "CLOSED", "MAINTENANCE"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </Select>
            </label>
          </div>
          <label className="block text-sm font-medium">Facilities (comma-separated)<Input value={form.facilities} onChange={(event) => setForm({ ...form, facilities: event.target.value })} placeholder="Medical, food, accessible" /></label>
          {role !== "SHELTER_MANAGER" && <label className="block text-sm font-medium">Shelter manager
            <Select disabled={loadingManagers} value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
              <option value="">{loadingManagers ? "Loading managers..." : "Unassigned"}</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
            </Select>
          </label>}
          <div className="flex gap-3"><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Register shelter"}</Button><Button onClick={() => router.push("/shelters")}>Cancel</Button></div>
        </form>
      </CardContent></Card>
    </div>
  );
}
