import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useStations } from "@/contexts/StationsContext";
import { MapPin, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { setupLeaflet } from "@/lib/leaflet-setup";
import MapResizer from "@/components/MapResizer";

setupLeaflet();


const busIcon = new L.DivIcon({
  html: `<div style="background-color: #2563EB; color: white; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  className: "custom-bus-icon",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const userIcon = new L.DivIcon({
  html: `<div style="background-color: #10B981; color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  className: "custom-user-icon",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

interface TrackMapProps {
  busLocation: [number, number] | null;
}

export default function TrackMap({ busLocation }: TrackMapProps) {
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

      {/* Bus Marker */}
      {busLocation && (
        <Marker position={busLocation} icon={busIcon}>
          <Popup>
            <div className="text-center font-bold text-primary">الباص هنا الآن!</div>
          </Popup>
        </Marker>
      )}

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
