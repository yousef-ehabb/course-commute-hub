import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useStations } from "@/contexts/StationsContext";
import { MapPin } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { setupLeaflet } from "@/lib/leaflet-setup";
import MapResizer from "@/components/MapResizer";

setupLeaflet();

// ── Vehicle marker icons ────────────────────────────────────────────────

function createVehicleIcon(
  variant: "available" | "full" | "mine",
  emoji: string
): L.DivIcon {
  const config = {
    available: {
      bg: "#10B981",
      border: "white",
      size: 38,
      pulse: "",
    },
    full: {
      bg: "#EF4444",
      border: "white",
      size: 34,
      pulse: "",
    },
    mine: {
      bg: "#2563EB",
      border: "#93C5FD",
      size: 44,
      pulse: "animation: pulse 2s infinite;",
    },
  }[variant];

  return new L.DivIcon({
    html: `<div style="
      background-color: ${config.bg};
      color: white;
      width: ${config.size}px;
      height: ${config.size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 3px solid ${config.border};
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: ${variant === "mine" ? "22px" : "18px"};
      ${config.pulse}
    "><span>${emoji}</span></div>
    <style>
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
        50% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
      }
    </style>`,
    className: `vehicle-marker-${variant}`,
    iconSize: [config.size, config.size],
    iconAnchor: [config.size / 2, config.size / 2],
  });
}

const userIcon = new L.DivIcon({
  html: `<div style="background-color: #10B981; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  className: "custom-user-icon",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// ── Types ───────────────────────────────────────────────────────────────

export interface VehicleMarker {
  id: string;
  position: [number, number];
  label: string;
  emoji: string;
  variant: "available" | "full" | "mine";
}

export interface CustomLocationMarkerData {
  id: string;
  studentName: string;
  locationName: string;
  position: [number, number];
}

interface TrackMapProps {
  vehicleMarkers: VehicleMarker[];
  customLocationMarkers?: CustomLocationMarkerData[];
  /** When set, the map smoothly pans to center on this vehicle */
  focusVehicleId?: string | null;
}

// ── Auto-fit bounds when markers change ─────────────────────────────────

function FitBoundsToMarkers({ markers }: { markers: VehicleMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    const bounds = L.latLngBounds(markers.map((m) => m.position));
    // Pad a bit so markers aren't on the edge
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [markers.length]); // Only re-fit when the count changes, not on every GPS tick

  return null;
}

// ── Recenter on focused vehicle change ──────────────────────────────────

function RecenterOnVehicle({
  markers,
  focusVehicleId,
}: {
  markers: VehicleMarker[];
  focusVehicleId: string | null;
}) {
  const map = useMap();
  const prevFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusVehicleId) return;
    // Only recenter when the focus changes, not on every render
    if (prevFocusRef.current === focusVehicleId) return;
    prevFocusRef.current = focusVehicleId;

    const marker = markers.find((m) => m.id === focusVehicleId);
    if (marker) {
      map.flyTo(marker.position, Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
    }
  }, [focusVehicleId, markers, map]);

  return null;
}

// ── Component ───────────────────────────────────────────────────────────

export default function TrackMap({
  vehicleMarkers,
  customLocationMarkers = [],
  focusVehicleId,
}: TrackMapProps) {
  const { stations } = useStations();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting user location:", error);
        },
      );
    }
  }, []);

  return (
    <MapContainer
      center={[24.0889, 32.8998]} // Aswan center
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizer />
      {vehicleMarkers.length > 0 && <FitBoundsToMarkers markers={vehicleMarkers} />}
      {focusVehicleId && (
        <RecenterOnVehicle markers={vehicleMarkers} focusVehicleId={focusVehicleId} />
      )}

      {/* Station Markers */}
      {stations.map((station) => (
        <Marker key={station.id} position={[station.latitude, station.longitude]}>
          <Popup className="font-cairo">
            <div className="text-right rtl">
              <div className="font-bold text-lg mb-1">{station.name}</div>
              <div className="text-sm text-gray-600">{station.detail}</div>
              <div className="mt-2 text-primary font-semibold flex items-center gap-1 justify-end">
                <span>{station.time}</span>
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Custom Pickup Location Student Markers */}
      {customLocationMarkers.map((clm) => (
        <Marker key={clm.id} position={clm.position}>
          <Popup className="font-cairo">
            <div className="text-right rtl p-1">
              <div className="text-[11px] font-bold text-primary mb-1">📍 موقع مخصص لانتظار الطالب</div>
              <div className="font-bold text-base text-gray-900 mb-0.5">{clm.studentName}</div>
              <div className="text-xs font-semibold text-gray-600 mb-2">الموقع: {clm.locationName}</div>
              <a
                href={`https://maps.google.com/?q=${clm.position[0]},${clm.position[1]}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity"
              >
                🗺️ التوجه إلى الموقع
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Vehicle Markers */}
      {vehicleMarkers.map((vm) => (
        <Marker
          key={vm.id}
          position={vm.position}
          icon={createVehicleIcon(vm.variant, vm.emoji)}
          opacity={vm.variant === "full" ? 0.6 : 1}
          zIndexOffset={vm.variant === "mine" ? 1000 : vm.variant === "available" ? 500 : 0}
        >
          <Popup className="font-cairo">
            <div className="text-center font-bold text-primary rtl">{vm.label}</div>
          </Popup>
        </Marker>
      ))}

      {/* User Location Marker */}
      {userLocation && (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>
            <div className="text-center font-bold text-emerald-500">أنت هنا</div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
