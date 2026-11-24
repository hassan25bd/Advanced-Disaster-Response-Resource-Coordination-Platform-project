"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";

type Team = {
  id: string; name: string; status: string; organizationId: string;
  organization: { name: string }; leader: { id: string; name: string } | null;
  tasks: { id: string; title: string; status: string; volunteer: { name: string } | null; incident: { title: string } | null }[];
};
type Volunteer = { id: string; name: string };

export default function TeamDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [team, setTeam] = useState<Team | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [form, setForm] = useState({ leaderId: "", status: "STANDBY" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const current = await apiFetch(`/api/teams/${encodeURIComponent(id)}`) as Team;
      setTeam(current);
      setForm({ leaderId: current.leader?.id || "", status: current.status });
      setError("");
      if (role && role !== "VOLUNTEER") {
        const users = await apiFetch("/api/users?role=VOLUNTEER&pageSize=100");
        setVolunteers(users.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load team.");
    } finally {
      setLoading(false);
    }
  }, [id, role]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/teams/${encodeURIComponent(id)}`).then(async (current: Team) => {
      const users = role && role !== "VOLUNTEER"
        ? await apiFetch("/api/users?role=VOLUNTEER&pageSize=100")
        : { data: [] };
      return { current, users };
    }).then(({ current, users }) => {
      if (!active) return;
      setTeam(current);
      setForm({ leaderId: current.leader?.id || "", status: current.status });
      setVolunteers(users.data);
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load team.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, role]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/teams/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(form) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update team.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading team...</p>;
  if (!team) return <p role="alert" className="text-rose-700">{error || "Team not found."}</p>;
  const canEdit = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "RELIEF_ORGANIZATION";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{team.name}</h1><p className="text-sm text-slate-500">{team.organization.name} · Leader: {team.leader?.name || "Unassigned"}</p></div><Button onClick={() => router.push("/teams")}>Back to teams</Button></div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {canEdit && <Card><CardHeader><CardTitle>Team settings</CardTitle></CardHeader><CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Leader<Select value={form.leaderId} onChange={(event) => setForm({ ...form, leaderId: event.target.value })}><option value="">Unassigned</option>{volunteers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</Select></label>
          <label className="text-sm font-medium">Status<Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["STANDBY", "ACTIVE", "DEPLOYED"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>
          <div><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Save team"}</Button></div>
        </form>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Assigned tasks</CardTitle></CardHeader><CardContent>
        {team.tasks.length ? <div className="divide-y">{team.tasks.map((task) => <div key={task.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><a className="font-medium text-rose-700 hover:underline" href={`/tasks/${task.id}`}>{task.title}</a><span>{task.incident?.title || "No incident"} · {task.volunteer?.name || "Unassigned"} · {statusLabel(task.status)}</span></div>)}</div> : <p className="text-sm text-slate-500">No tasks assigned to this team.</p>}
      </CardContent></Card>
    </div>
  );
}
