"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { MAX_TASK_FIELD_PHOTOS, readImageFile } from "@/lib/image-upload";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";

type Task = {
  id: string; title: string; description: string; location: string; status: string;
  fieldReport: string | null; fieldPhotos: string[]; assignedAt: string; completedAt: string | null;
  history: { id: string; action: string; details: string | null; timestamp: string; user: { name: string } }[];
  incident: { id: string; title: string; location: string } | null;
  team: { name: string; organization: { name: string } } | null;
  volunteer: { name: string; email: string } | null;
};

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [task, setTask] = useState<Task | null>(null);
  const [status, setStatus] = useState("ASSIGNED");
  const [fieldReport, setFieldReport] = useState("");
  const [fieldPhotos, setFieldPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch(`/api/tasks/${encodeURIComponent(id)}`) as Task;
      setTask(result);
      setStatus(result.status);
      setFieldReport(result.fieldReport || "");
      setFieldPhotos(result.fieldPhotos || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load task.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/tasks/${encodeURIComponent(id)}`).then((result: Task) => {
      if (!active) return;
      setTask(result);
      setStatus(result.status);
      setFieldReport(result.fieldReport || "");
      setFieldPhotos(result.fieldPhotos || []);
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load task.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    try {
      const newPhotos = await Promise.all(Array.from(files).map(readImageFile));
      if (fieldPhotos.length + newPhotos.length > MAX_TASK_FIELD_PHOTOS) throw new Error(`A task can retain up to ${MAX_TASK_FIELD_PHOTOS} field photographs.`);
      setFieldPhotos((current) => [...current, ...newPhotos]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add field photographs.");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(role === "RELIEF_ORGANIZATION" ? { fieldReport } : { status, fieldReport, fieldPhotos }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading task...</p>;
  if (!task) return <p role="alert" className="text-rose-700">{error || "Task not found."}</p>;
  const isVolunteer = role === "VOLUNTEER";
  const isOrganization = role === "RELIEF_ORGANIZATION";
  const canUpdate = isVolunteer || role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "RELIEF_ORGANIZATION";
  const completed = task.status === "COMPLETED";
  const statuses = isVolunteer
    ? task.status === "ASSIGNED" ? ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"]
      : task.status === "ACCEPTED" ? ["ACCEPTED", "IN_PROGRESS", "COMPLETED"]
        : task.status === "IN_PROGRESS" ? ["IN_PROGRESS", "COMPLETED"] : ["COMPLETED"]
    : ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{task.title}</h1><p className="text-sm text-slate-500">{statusLabel(task.status)} · {task.location || "Location not set"}</p></div><Button onClick={() => router.push("/tasks")}>Back to tasks</Button></div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Assignment details</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <p><strong>Incident:</strong> {task.incident?.title || "—"}</p><p><strong>Incident location:</strong> {task.incident?.location || "—"}</p>
        <p><strong>Team:</strong> {task.team?.name || "Unassigned"} {task.team?.organization?.name ? `· ${task.team.organization.name}` : ""}</p><p><strong>Volunteer:</strong> {task.volunteer?.name || "Unassigned"}</p>
        <p><strong>Assigned:</strong> {new Date(task.assignedAt).toLocaleString()}</p><p><strong>Completed:</strong> {task.completedAt ? new Date(task.completedAt).toLocaleString() : "Not completed"}</p>
        <p className="sm:col-span-2"><strong>Instructions:</strong> {task.description || "No instructions provided."}</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Volunteer activity history</CardTitle></CardHeader><CardContent>
        {task.history.length ? <ul className="space-y-2">{task.history.map((entry) => <li key={entry.id} className="border-b py-2 text-sm">{entry.action.replaceAll("_", " ")} · {entry.details || "Task update"} · {entry.user.name} · {new Date(entry.timestamp).toLocaleString()}</li>)}</ul> : <p className="text-sm text-slate-500">No task updates recorded.</p>}
      </CardContent></Card>
      {canUpdate && <Card><CardHeader><CardTitle>Field report and progress</CardTitle></CardHeader><CardContent>
        {completed ? <p>This task is complete. Its report and photographs are preserved.</p> : <form onSubmit={save} className="space-y-4">
          {isOrganization ? <p className="text-sm"><strong>Status:</strong> {statusLabel(task.status)}</p> : <label className="block text-sm font-medium">Task status<Select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>}
          <label className="block text-sm font-medium">Field report<textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-300 p-2" value={fieldReport} onChange={(event) => setFieldReport(event.target.value)} placeholder="Record observations and work completed" /></label>
          <div className="space-y-2">{!isOrganization && <label className="block text-sm font-medium">Field photographs (up to {MAX_TASK_FIELD_PHOTOS}, 800 KB each)<input className="mt-1 block w-full text-sm" type="file" accept="image/*" multiple disabled={isVolunteer && fieldPhotos.length >= MAX_TASK_FIELD_PHOTOS} onChange={(event) => { void addPhotos(event.target.files); event.currentTarget.value = ""; }} /></label>}
            {fieldPhotos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fieldPhotos.map((photo, index) => <div key={`${index}-${photo.slice(0, 30)}`} className="space-y-1"><img src={photo} alt={`Field photograph ${index + 1}`} className="h-32 w-full rounded object-cover" />{!isVolunteer && <Button type="button" onClick={() => setFieldPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>}</div>)}</div>}
          </div>
          <Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Save field update"}</Button>
        </form>}
      </CardContent></Card>}
    </div>
  );
}
