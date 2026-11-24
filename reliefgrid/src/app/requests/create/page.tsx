"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Textarea } from "@/components/ui";
import { apiFetch, statusLabel } from "@/lib/api";

type Incident = { id: string; title: string; isDemo?: boolean };

export default function CreateRequestPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    incidentId: "", type: "FOOD", quantity: "", location: "", latitude: "", longitude: "",
    priority: "MEDIUM", affectedPeople: "", description: "",
  });

  useEffect(() => {
    apiFetch("/api/incidents?pageSize=100")
      .then((result: { data: Incident[] }) => setIncidents(result.data.filter((incident) => !incident.isDemo)))
      .catch(() => setError("Unable to load incidents. Please try again."))
      .finally(() => setLoadingIncidents(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const request = await apiFetch("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          affectedPeople: Number(form.affectedPeople),
          latitude: form.latitude === "" ? undefined : Number(form.latitude),
          longitude: form.longitude === "" ? undefined : Number(form.longitude),
        }),
      });
      router.push(`/requests/${encodeURIComponent(request.id)}`);
    } catch {
      setError("Unable to submit the request. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">New Emergency Request</h1>
      {error && <p role="alert" className="rounded border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Incident
              <Select required value={form.incidentId} onChange={(e) => setForm({ ...form, incidentId: e.target.value })}>
                <option value="">{loadingIncidents ? "Loading incidents..." : "Select an incident"}</option>
                {incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.title}</option>)}
              </Select>
            </label>
            {!loadingIncidents && incidents.length === 0 && <p className="text-sm text-slate-500">No incidents available. Report an incident first.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Request type
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORTATION"].map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
                </Select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Required quantity
                <Input required type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Location
                <Input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Priority
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}
                </Select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Affected people
                <Input required type="number" min="0" step="1" value={form.affectedPeople} onChange={(e) => setForm({ ...form, affectedPeople: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Latitude
                <Input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Longitude
                <Input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </label>
            </div>
            <p className="text-sm text-slate-500">If coordinates are omitted, the incident coordinates are used.</p>
            <label className="block text-sm font-medium text-slate-700">Description
              <Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || loadingIncidents || incidents.length === 0} className="bg-rose-600 text-white hover:bg-rose-700">{saving ? "Submitting..." : "Submit request"}</Button>
              <Button onClick={() => router.push("/requests")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
