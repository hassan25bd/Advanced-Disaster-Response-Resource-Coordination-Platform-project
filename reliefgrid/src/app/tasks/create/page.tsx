"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type Option = { id: string; title?: string; name?: string; location?: string };

export default function CreateTaskPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [volunteers, setVolunteers] = useState<Option[]>([]);
  const [form, setForm] = useState({ title: "", description: "", incidentId: "", teamId: "", volunteerId: "", location: "", latitude: "", longitude: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/incidents?pageSize=100"),
      apiFetch("/api/teams?pageSize=100"),
      apiFetch("/api/users?role=VOLUNTEER&pageSize=100"),
    ]).then(([incidentResult, teamResult, volunteerResult]) => {
      setIncidents(incidentResult.data);
      setTeams(teamResult.data);
      setVolunteers(volunteerResult.data);
      setError("");
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load task options."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude || 0),
          longitude: Number(form.longitude || 0),
        }),
      });
      router.push("/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Assign volunteer task</h1>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Task assignment</CardTitle></CardHeader><CardContent>
        {loading ? <p>Loading incidents, teams, and volunteers...</p> : <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Task title<Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="block text-sm font-medium">Incident<Select required value={form.incidentId} onChange={(event) => setForm({ ...form, incidentId: event.target.value })}><option value="">Select an incident</option>{incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.title} — {incident.location}</option>)}</Select></label>
          <label className="block text-sm font-medium">Team<Select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></label>
          <label className="block text-sm font-medium">Volunteer<Select value={form.volunteerId} onChange={(event) => setForm({ ...form, volunteerId: event.target.value })}><option value="">Unassigned</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name}</option>)}</Select></label>
          <label className="block text-sm font-medium">Description<textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="block text-sm font-medium">Task location<Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Latitude<Input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label><label className="text-sm font-medium">Longitude<Input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label></div>
          <div className="flex gap-3"><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Assigning..." : "Assign task"}</Button><Button onClick={() => router.push("/tasks")}>Cancel</Button></div>
        </form>}
      </CardContent></Card>
    </div>
  );
}
