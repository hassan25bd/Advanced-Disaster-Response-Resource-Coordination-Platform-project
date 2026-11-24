"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Input, Select, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const user = (session?.user as any) || {};

  useEffect(() => {
    apiFetch("/api/me").then(setProfile).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center">Loading profile...</div>;
  if (!profile) return <div className="py-10 text-center">Profile not found.</div>;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await apiFetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: (e.target as any).elements.namedItem("name").value,
          phone: (e.target as any).elements.namedItem("phone").value,
          availabilityStatus: (e.target as any).elements.namedItem("availabilityStatus").value,
        }),
      });
      setMessage("Profile updated successfully");
    } catch (err: any) {
      setMessage(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
          <p className="text-slate-500 text-sm">Manage your account and preferences</p>
        </div>
      </div>

      {message && <div className="p-3 rounded bg-green-50 text-green-700 text-sm border border-green-100">{message}</div>}

      <Card>
        <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <Input name="name" defaultValue={profile.name} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <Input name="email" defaultValue={profile.email} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <Input name="phone" defaultValue={profile.phone || ""} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <Input name="role" defaultValue={statusLabel(profile.role)} readOnly className="bg-slate-50" />
              </div>
            </div>
            {profile.role === "VOLUNTEER" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Availability Status</label>
                <Select name="availabilityStatus" defaultValue={profile.availabilityStatus}>
                  <option value="AVAILABLE">Available</option>
                  <option value="BUSY">Busy</option>
                  <option value="OFF_DUTY">Off Duty</option>
                </Select>
              </div>
            )}
            {profile.organization && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                  <Input name="organization" defaultValue={profile.organization.name} readOnly className="bg-slate-50" />
                </div>
              </div>
            )}
            <Button type="submit" disabled={saving} className="bg-rose-600 hover:bg-rose-700">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
