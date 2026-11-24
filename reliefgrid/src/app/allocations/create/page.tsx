"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";

type RequestOption = { id: string; type: string; location: string; quantity: number; status: string; incident?: { title: string }; allocations: { allocatedQuantity: number; status: string }[] };
type ResourceOption = { id: string; name: string; category: string; organizationId: string; organization?: { name: string }; availableQuantity: number; unit: string };

function getRemainingQuantity(request: RequestOption) {
  const allocated = request.allocations
    .filter((allocation) => allocation.status !== "CANCELLED")
    .reduce((sum, allocation) => sum + allocation.allocatedQuantity, 0);
  return Math.max(0, request.quantity - allocated);
}

export default function CreateAllocationPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [form, setForm] = useState({ requestId: "", resourceId: "", allocatedQuantity: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/requests?pageSize=100"),
      apiFetch("/api/resources?pageSize=100"),
    ]).then(([requestResult, resourceResult]) => {
      setRequests(requestResult.data.filter((request: RequestOption) =>
        ["VERIFIED", "ALLOCATED", "IN_TRANSIT"].includes(request.status) && getRemainingQuantity(request) > 0
      ));
      setResources(resourceResult.data);
      setError("");
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load allocation options."))
      .finally(() => setLoading(false));
  }, []);

  const selectedResource = resources.find((resource) => resource.id === form.resourceId);
  const selectedRequest = requests.find((request) => request.id === form.requestId);
  const remainingRequestQuantity = selectedRequest ? getRemainingQuantity(selectedRequest) : 0;
  const compatibleCategories: Record<string, string[]> = {
    FOOD: ["FOOD_PACKAGES"], WATER: ["DRINKING_WATER"], MEDICAL: ["MEDICAL_SUPPLIES"],
    SHELTER: ["EMERGENCY_KITS", "BLANKETS"], RESCUE: ["RESCUE_EQUIPMENT", "TRANSPORTATION"],
    TRANSPORTATION: ["TRANSPORTATION"],
  };
  const availableResources = resources.filter((resource) =>
    resource.availableQuantity > 0 && !!selectedRequest && compatibleCategories[selectedRequest.type]?.includes(resource.category)
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!selectedResource) throw new Error("Select an available resource.");
      await apiFetch("/api/allocations", {
        method: "POST",
        body: JSON.stringify({
          requestId: form.requestId,
          resourceId: selectedResource.id,
          organizationId: selectedResource.organizationId,
          allocatedQuantity: Number(form.allocatedQuantity),
        }),
      });
      router.push("/allocations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create allocation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Allocate resource</h1>
      {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card><CardHeader><CardTitle>Verified request and inventory</CardTitle></CardHeader><CardContent>
        {loading ? <p>Loading verified requests and resources...</p> : <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Emergency request<Select required value={form.requestId} onChange={(event) => setForm({ ...form, requestId: event.target.value, resourceId: "", allocatedQuantity: "" })}><option value="">Select an open request</option>{requests.map((request) => <option key={request.id} value={request.id}>{request.incident?.title || "Request"} · {statusLabel(request.type)} · {request.location} ({request.quantity} requested)</option>)}</Select></label>
          <label className="block text-sm font-medium">Resource<Select required value={form.resourceId} onChange={(event) => setForm({ ...form, resourceId: event.target.value, allocatedQuantity: "" })}><option value="">Select a matching resource</option>{availableResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} — {resource.organization?.name || "Organization"} ({resource.availableQuantity} {resource.unit})</option>)}</Select></label>
          {selectedResource && <p className="text-sm text-slate-600">Available stock: {selectedResource.availableQuantity} {selectedResource.unit}</p>}
          {selectedRequest && <p className="text-sm text-slate-600">Request quantity remaining: {remainingRequestQuantity}</p>}
          <label className="block text-sm font-medium">Allocation quantity<Input required type="number" min="1" max={Math.min(selectedResource?.availableQuantity || 0, remainingRequestQuantity) || undefined} step="1" value={form.allocatedQuantity} onChange={(event) => setForm({ ...form, allocatedQuantity: event.target.value })} /></label>
          {!requests.length && <p className="text-sm text-amber-700">There are no open verified or partially allocated requests.</p>}
          {!!selectedRequest && !availableResources.length && <p className="text-sm text-amber-700">No compatible resource is currently available for this request.</p>}
          <div className="flex gap-3"><Button type="submit" disabled={saving || !requests.length || !selectedResource || remainingRequestQuantity < 1} className="bg-rose-600 text-white">{saving ? "Allocating..." : "Create allocation"}</Button><Button onClick={() => router.push("/allocations")}>Cancel</Button></div>
        </form>}
      </CardContent></Card>
    </div>
  );
}
