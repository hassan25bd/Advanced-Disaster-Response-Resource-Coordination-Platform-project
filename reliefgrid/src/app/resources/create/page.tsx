"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type Organization = { id: string; name: string };

export default function CreateResourcePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState({
    name: "", category: "FOOD_PACKAGES", totalQuantity: "", availableQuantity: "",
    unit: "units", storageLocation: "", latitude: "", longitude: "", organizationId: "",
  });
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!role) return;
    apiFetch("/api/organizations?pageSize=100")
      .then((result: { data: Organization[] }) => {
        setOrganizations(result.data);
        if (result.data.length === 1) setForm((current) => ({ ...current, organizationId: result.data[0].id }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load organizations."))
      .finally(() => setLoadingOrganizations(false));
  }, [role]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          totalQuantity: Number(form.totalQuantity),
          availableQuantity: form.availableQuantity === "" ? Number(form.totalQuantity) : Number(form.availableQuantity),
          latitude: Number(form.latitude || 0),
          longitude: Number(form.longitude || 0),
        }),
      });
      router.push("/resources");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register resource.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Register Resource</h1>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Inventory details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">Resource name
              <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="block text-sm font-medium">Category
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {["FOOD_PACKAGES", "DRINKING_WATER", "MEDICAL_SUPPLIES", "EMERGENCY_KITS", "BLANKETS", "RESCUE_EQUIPMENT", "TRANSPORTATION"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </Select>
            </label>
            {role !== "RELIEF_ORGANIZATION" && (
              <label className="block text-sm font-medium">Organization
                <Select required disabled={loadingOrganizations} value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
                  <option value="">{loadingOrganizations ? "Loading organizations..." : "Select an organization"}</option>
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </Select>
              </label>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Total quantity
                <Input required type="number" min="0" step="1" value={form.totalQuantity} onChange={(event) => setForm({ ...form, totalQuantity: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Available quantity
                <Input type="number" min="0" step="1" value={form.availableQuantity} onChange={(event) => setForm({ ...form, availableQuantity: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Unit
                <Input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Storage location
                <Input required value={form.storageLocation} onChange={(event) => setForm({ ...form, storageLocation: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Latitude
                <Input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Longitude
                <Input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} />
              </label>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || loadingOrganizations} className="bg-rose-600 text-white hover:bg-rose-700">{saving ? "Saving..." : "Register resource"}</Button>
              <Button onClick={() => router.push("/resources")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
