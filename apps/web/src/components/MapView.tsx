"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { GeofenceDTO, LocationDTO } from "@retrouve/shared";
import { DEVICE_ICON, formatDateTime } from "@/lib/format";

export interface MapDevice {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  lost: boolean;
  recordedAt: string;
}

interface Props {
  devices?: MapDevice[];
  track?: LocationDTO[];
  geofences?: GeofenceDTO[];
  draftFence?: { lat: number; lng: number; radiusM: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onDeviceClick?: (id: string) => void;
  className?: string;
}

const MADAGASCAR: [number, number] = [-18.8792, 47.5079];

function pinIcon(type: string, lost: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="device-pin${lost ? " lost" : ""}">${DEVICE_ICON[type] ?? "📍"}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0]!, Math.max(map.getZoom(), 16));
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    // On ne recadre que quand l'ensemble des points change réellement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({ devices = [], track = [], geofences = [], draftFence, onMapClick, onDeviceClick, className }: Props) {
  // Cadrage : tous les appareils, plus le trajet affiché.
  const fitPoints = useMemo<[number, number][]>(
    () => [...devices.map((d) => [d.lat, d.lng] as [number, number]), ...track.map((t) => [t.lat, t.lng] as [number, number])],
    [devices, track],
  );
  const line = track.map((t) => [t.lat, t.lng] as [number, number]);

  return (
    <MapContainer center={MADAGASCAR} zoom={6} className={className ?? "h-[420px] w-full rounded-2xl"} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={fitPoints} />
      <ClickHandler onClick={onMapClick} />

      {geofences.map((g) => (
        <Circle
          key={g.id}
          center={[g.lat, g.lng]}
          radius={g.radiusM}
          pathOptions={{ color: g.enabled ? "#16a34a" : "#9ca3af", weight: 2, fillOpacity: 0.08, dashArray: "6 6" }}
        >
          <Popup>Zone « {g.name} » ({g.radiusM} m)</Popup>
        </Circle>
      ))}
      {draftFence && (
        <Circle center={[draftFence.lat, draftFence.lng]} radius={draftFence.radiusM} pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.12 }} />
      )}

      {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#3b6ef5", weight: 3, opacity: 0.7 }} />}
      {track.slice(0, -1).map((t) => (
        <CircleMarker key={t.id} center={[t.lat, t.lng]} radius={3.5} pathOptions={{ color: "#3b6ef5", fillOpacity: 0.9, weight: 1 }}>
          <Popup>
            {formatDateTime(t.recordedAt)}
            {t.accuracy != null && <> · ±{Math.round(t.accuracy)} m</>}
            {t.battery != null && <> · 🔋 {t.battery} %</>}
          </Popup>
        </CircleMarker>
      ))}

      {devices.map((d) => (
        <span key={d.id}>
          {d.accuracy != null && d.accuracy > 0 && (
            <Circle center={[d.lat, d.lng]} radius={d.accuracy} pathOptions={{ color: d.lost ? "#dc2626" : "#3b6ef5", weight: 1, fillOpacity: 0.1 }} />
          )}
          <Marker
            position={[d.lat, d.lng]}
            icon={pinIcon(d.type, d.lost)}
            eventHandlers={onDeviceClick ? { click: () => onDeviceClick(d.id) } : undefined}
          >
            <Popup>
              <b>{d.name}</b>
              <br />
              {formatDateTime(d.recordedAt)}
              {d.accuracy != null && <> · ±{Math.round(d.accuracy)} m</>}
              <br />
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`} target="_blank" rel="noreferrer">
                Itinéraire
              </a>
            </Popup>
          </Marker>
        </span>
      ))}
    </MapContainer>
  );
}
