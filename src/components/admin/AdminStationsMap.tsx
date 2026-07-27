import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Station } from "@/contexts/StationsContext";
import { MapPin } from "lucide-react";

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface AdminStationsMapProps {
  stations: Station[];
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
    </MapContainer>
  );
}
