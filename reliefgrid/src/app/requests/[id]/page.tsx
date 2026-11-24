"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { apiFetch, statusLabel } from "@/lib/api";

type RequestDetails = {
  id: string; type: string; quantity: number; location: string; priority: string;
  status: string; affectedPeople: number; description: string | null; createdAt: string;
  duplicateFlag: boolean;
  incident: { title: string };
  allocations: { id: string; allocatedQuantity: number; status: string; resource: { name: string }; organization: { name: string } }[];
};

export default function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/requests/${encodeURIComponent(id)}`)
      .then(setRequest)
      .catch(() => setError("Unable to load this request."))
      .finally(() => setLoading(false));
  }, [id]);

  async function verify(status: "VERIFIED" | "REJECTED") {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setRequest((current) => current && { ...current, status });
    } catch {
      setError("Unable to update the request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading request...</p>;
  if (!request) return <p role="alert" className="text-rose-700">{error || "Request not found."}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Emergency Request</h1>
        <Button onClick={() => router.push("/requests")}>Back to requests</Button>
      </div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {request.duplicateFlag && <p role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This request was recorded but rejected as a possible duplicate.</p>}
      <Card>
        <CardHeader><CardTitle>{request.incident.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Type", statusLabel(request.type)], ["Quantity", request.quantity],
              ["Location", request.location], ["Priority", statusLabel(request.priority)],
              ["Status", statusLabel(request.status)], ["Affected people", request.affectedPeople],
              ["Submitted", new Date(request.createdAt).toLocaleString()],
            ].map(([label, value]) => <div key={label}><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="text-slate-900">{value}</dd></div>)}
          </dl>
          <p className="text-sm text-slate-700">{request.description || "No description provided."}</p>
          {request.status === "PENDING" && role && ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(role) && (
            <div className="flex gap-3">
              <Button disabled={saving} onClick={() => verify("VERIFIED")} className="bg-rose-600 text-white hover:bg-rose-700">Verify request</Button>
              <Button disabled={saving} onClick={() => verify("REJECTED")} className="border border-slate-300">Reject request</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Allocations</CardTitle></CardHeader>
        <CardContent>
          {request.allocations.length === 0 ? <p className="text-sm text-slate-500">No allocations yet.</p> : (
            <ul className="space-y-2">
              {request.allocations.map((allocation) => <li key={allocation.id} className="text-sm text-slate-700">{allocation.resource.name} — {allocation.allocatedQuantity} — {allocation.organization.name} — {statusLabel(allocation.status)}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
