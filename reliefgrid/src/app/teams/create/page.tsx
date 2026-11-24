"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type Organization = { id: string; name: string };
type Volunteer = { id: string; name: string };

export default function CreateTeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [form, setForm] = useState({ name: "", organizationId: "", leaderId: "", status: "STANDBY" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!role) return;
    Promise.all([
      apiFetch("/api/organizations?pageSize=100"),
      apiFetch("/api/users?role=VOLUNTEER&pageSize=100"),
    ]).then(([orgs, users]) => {
      setOrganizations(orgs.data);
      setVolunteers(users.data);
      if (orgs.data.length === 1) setForm((current) => ({ ...current, organizationId: orgs.data[0].id }));
      setError("");
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load team options."))
      .finally(() => setLoading(false));
  }, [role]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/teams", { method: "POST", body: JSON.stringify(form) });
      router.push("/teams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create team.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Create response team</h1>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Team details</CardTitle></CardHeader><CardContent>
        {loading ? <p>Loading organizations and volunteers...</p> : <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Team name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          {role === "SYSTEM_ADMIN" && <label className="block text-sm font-medium">Organization
            <Select required value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
              <option value="">Select an organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </Select>
          </label>}
          <label className="block text-sm font-medium">Team leader
            <Select value={form.leaderId} onChange={(event) => setForm({ ...form, leaderId: event.target.value })}>
              <option value="">Unassigned</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.name}</option>)}
            </Select>
          </label>
          <label className="block text-sm font-medium">Status
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {["STANDBY", "ACTIVE", "DEPLOYED"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </label>
          <div className="flex gap-3"><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Creating..." : "Create team"}</Button><Button onClick={() => router.push("/teams")}>Cancel</Button></div>
        </form>}
      </CardContent></Card>
    </div>
  );
}
