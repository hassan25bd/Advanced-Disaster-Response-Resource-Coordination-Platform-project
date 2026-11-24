"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import nextDynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapContainer = nextDynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = nextDynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = nextDynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = nextDynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

export default function MapPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [shelters, setShelters] = useState<any[]>([]);
  const [center, setCenter] = useState<[number, number]>([22.5726, 88.3639]);

  useEffect(() => {
    Promise.all([apiFetch("/api/incidents?pageSize=100"), apiFetch("/api/shelters?pageSize=100")])
      .then(([i, s]) => {
        setIncidents(i.data);
        setShelters(s.data);
        if (i.data.length) setCenter([i.data[0].latitude, i.data[0].longitude]);
      });
  }, []);

  const position: [number, number] = center;

  return (
    <div className="flex h-screen">
      <div className="w-1/4 bg-white border-r border-slate-200 p-4 overflow-y-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Live Incident Map</h1>
        <p className="text-sm text-slate-500 mb-4">Incidents and shelter locations</p>
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="p-3 border border-slate-100 rounded cursor-pointer hover:bg-slate-50" onClick={() => setCenter([inc.latitude, inc.longitude])}>
              <div className="font-medium text-slate-900 text-sm">{inc.title}</div>
              <div className="text-xs text-slate-500">{inc.location} â€¢ {inc.severity}</div>
            </div>
          ))}
          {incidents.length === 0 && <div className="text-xs text-slate-400">No incidents</div>}
        </div>
      </div>
      <div className="flex-1 relative">
        <MapContainer center={position} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {incidents.map((inc) => (
            <Marker key={inc.id} position={[inc.latitude, inc.longitude]}>
              <Popup>
                <div className="p-2">
                  <div className="font-bold">{inc.title}</div>
                  <div className="text-xs text-slate-500">{inc.location}</div>
                  <div className="text-xs text-slate-500 mt-1">Severity: {inc.severity}</div>
                </div>
              </Popup>
            </Marker>
          ))}
          {shelters.map((sh) => (
            <Marker key={sh.id} position={[sh.latitude, sh.longitude]}>
              <Popup>
                <div className="p-2">
                  <div className="font-bold text-green-700">{sh.name}</div>
                  <div className="text-xs text-slate-500">{sh.currentOccupancy}/{sh.totalCapacity}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

