"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type UserRecord = {
  id: string; name: string; email: string; role: string; organizationId: string | null;
  phone: string | null; availabilityStatus: string; isActive: boolean; createdAt: string;
  organization: { id: string; name: string } | null;
  _count: { incidents: number; allocations: number; teamsLed: number; tasks: number };
};
type Organization = { id: string; name: string };

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUser = session?.user as { id?: string; role?: string } | undefined;
  const isAdmin = currentUser?.role === "SYSTEM_ADMIN";
  const isSelf = currentUser?.id === id;
  const [target, setTarget] = useState<UserRecord | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", role: "VOLUNTEER", organizationId: "", phone: "",
    availabilityStatus: "OFF_DUTY", isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUserData = useCallback(async () => {
    const result = await apiFetch(`/api/users/${encodeURIComponent(id)}`) as UserRecord;
    const orgResult = isAdmin ? await apiFetch("/api/organizations?pageSize=100") : { data: [] };
    return { result, organizations: orgResult.data as Organization[] };
  }, [id, isAdmin]);

  useEffect(() => {
    let active = true;
    fetchUserData().then(({ result, organizations: orgs }) => {
      if (!active) return;
      setTarget(result);
      setForm({
        name: result.name,
        email: result.email,
        role: result.role,
        organizationId: result.organizationId || "",
        phone: result.phone || "",
        availabilityStatus: result.availabilityStatus,
        isActive: result.isActive,
      });
      setOrganizations(orgs);
      setError("");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load user.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchUserData]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, organizationId: form.organizationId || null }),
      });
      const { result, organizations: orgs } = await fetchUserData();
      setTarget(result);
      setForm({
        name: result.name,
        email: result.email,
        role: result.role,
        organizationId: result.organizationId || "",
        phone: result.phone || "",
        availabilityStatus: result.availabilityStatus,
        isActive: result.isActive,
      });
      setOrganizations(orgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center">Loading user...</p>;
  if (!target) return <p role="alert" className="text-rose-700">{error || "User not found."}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{target.name}</h1><p className="text-sm text-slate-500">{statusLabel(target.role)} · {target.organization?.name || "No organization"}</p></div><Button onClick={() => router.push(currentUser?.role === "SYSTEM_ADMIN" ? "/users" : "/volunteers")}>Back</Button></div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Profile and permissions</CardTitle></CardHeader><CardContent>
        {isAdmin ? <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="text-sm font-medium">Email<Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="text-sm font-medium">Phone<Input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label className="text-sm font-medium">Role<Select value={form.role} disabled={isSelf} onChange={(event) => setForm({ ...form, role: event.target.value })}>{["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"].map((role) => <option key={role} value={role}>{statusLabel(role)}</option>)}</Select></label>
          <label className="text-sm font-medium">Organization<Select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}><option value="">Unassigned</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</Select></label>
          <label className="text-sm font-medium">Availability<Select value={form.availabilityStatus} onChange={(event) => setForm({ ...form, availabilityStatus: event.target.value })}>{["AVAILABLE", "BUSY", "OFF_DUTY"].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select></label>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={form.isActive} disabled={isSelf} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Account active</label>
          <div className="sm:col-span-2"><Button type="submit" disabled={saving} className="bg-rose-600 text-white">{saving ? "Saving..." : "Save user"}</Button></div>
        </form> : <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><strong>Email:</strong> {target.email}</p><p><strong>Phone:</strong> {target.phone || "Not provided"}</p>
          <p><strong>Availability:</strong> {statusLabel(target.availabilityStatus)}</p><p><strong>Account:</strong> {target.isActive ? "Active" : "Inactive"}</p>
          <p><strong>Joined:</strong> {new Date(target.createdAt).toLocaleDateString()}</p>
        </div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Operational activity</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <p><strong>Reported incidents:</strong> {target._count.incidents}</p>
        <p><strong>Resource allocations coordinated:</strong> {target._count.allocations}</p>
        <p><strong>Teams led:</strong> {target._count.teamsLed}</p>
        <p><strong>Volunteer tasks:</strong> {target._count.tasks}</p>
      </CardContent></Card>
    </div>
  );
}
