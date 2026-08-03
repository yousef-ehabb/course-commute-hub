import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Station } from "@/contexts/StationsContext";
import { MapPin } from "lucide-react";

import { setupLeaflet } from "@/lib/leaflet-setup";
import MapResizer from "@/components/MapResizer";

setupLeaflet();


export interface CustomStudentMarker {
  id: string;
  studentName: string;
  locationName: string;
  lat: number;
  lng: number;
}

interface AdminStationsMapProps {
  stations: Station[];
  customLocationMarkers?: CustomStudentMarker[];
  onAddStation?: (lat: number, lng: number) => void;
  activeStationId?: string | null;
}

function MapEvents({ onAddStation }: { onAddStation?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onAddStation) {
        onAddStation(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function AdminStationsMap({
  stations,
  customLocationMarkers = [],
  onAddStation,
  activeStationId,
}: AdminStationsMapProps) {
  return (
    <MapContainer
      center={[24.0889, 32.8998]}
      zoom={14}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={true}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizer />
      <MapEvents onAddStation={onAddStation} />

      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.latitude, station.longitude]}
          opacity={activeStationId && activeStationId !== station.id ? 0.5 : 1}
        >
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

      {customLocationMarkers.map((clm) => (
        <Marker key={clm.id} position={[clm.lat, clm.lng]}>
          <Popup className="font-cairo">
            <div className="text-right rtl p-1">
              <div className="text-[11px] font-bold text-primary mb-1">📍 موقع مخصص لانتظار الطالب</div>
              <div className="font-bold text-base text-gray-900 mb-0.5">{clm.studentName}</div>
              <div className="text-xs font-semibold text-gray-600 mb-2">الموقع: {clm.locationName}</div>
              <a
                href={`https://maps.google.com/?q=${clm.lat},${clm.lng}`}
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
    </MapContainer>
  );
}
