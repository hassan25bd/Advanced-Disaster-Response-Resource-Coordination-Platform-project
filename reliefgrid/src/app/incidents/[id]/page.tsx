"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, statusLabel } from "@/lib/api";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function IncidentDetailsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = (session?.user as any) || {};

  useEffect(() => {
    apiFetch(`/api/incidents/${params.id}`).then(setIncident).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="py-10 text-center">Loading incident...</div>;
  if (!incident) return <div className="py-10 text-center">Incident not found.</div>;

  const SEVERITY_BADGE: Record<string, string> = { LOW: "bg-green-100 text-green-700", MEDIUM: "bg-yellow-100 text-yellow-700", HIGH: "bg-orange-100 text-orange-700", CRITICAL: "bg-rose-100 text-rose-700" };
  const STATUS_BADGE: Record<string, string> = { REPORTED: "bg-slate-100 text-slate-700", VERIFIED: "bg-blue-100 text-blue-700", IN_PROGRESS: "bg-indigo-100 text-indigo-700", RESOLVED: "bg-green-100 text-green-700" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incident Details</h1>
          <p className="text-slate-500 text-sm">{incident.location}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/incidents")}>Back</Button>
          {["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(user?.role) && !incident.isDemo && (
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => router.push(`/incidents/${params.id}/edit`)}>
              Edit
            </Button>
          )}
        </div>
      </div>
      {incident.isDemo && <p role="status" className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Shared sample record · read-only</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-2 md:col-span-2">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-lg font-semibold">{incident.title}</p>
            <p className="text-slate-600">{incident.description}</p>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
              <div><p className="text-xs text-slate-500 uppercase">Category</p><p className="font-medium">{statusLabel(incident.category)}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Severity</p><Badge className={SEVERITY_BADGE[incident.severity] || ""}>{statusLabel(incident.severity)}</Badge></div>
              <div><p className="text-xs text-slate-500 uppercase">Status</p><Badge className={STATUS_BADGE[incident.status] || ""}>{statusLabel(incident.status)}</Badge></div>
              <div><p className="text-xs text-slate-500 uppercase">Priority Score</p><p className="font-medium">{incident.priorityScore}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Location Risk (0–5)</p><p className="font-medium">{incident.locationRiskScore === 0 ? "Unassessed" : incident.locationRiskScore}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Affected Population</p><p className="font-medium">{incident.affectedPopulation.toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Coordinator</p><p className="font-medium">{incident.coordinator?.name || "Not assigned"}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium text-slate-900">{incident.location}</p>
            <p className="text-xs text-slate-500">Lat: {incident.latitude.toFixed(4)}</p>
            <p className="text-xs text-slate-500">Lng: {incident.longitude.toFixed(4)}</p>
            <div className="h-32 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-sm">Map Preview</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {incident.history?.length ? (
              incident.history.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 p-3 border border-slate-100 rounded bg-slate-50">
                  <div className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center flex-shrink-0">{h.timestamp.slice(5, 16)}</div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{statusLabel(h.action)}</p>
                    {h.newValue && <p className="text-xs text-slate-500">{h.changedBy?.name} changed to: {h.newValue}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No history recorded.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
