import { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { setupLeaflet } from "@/lib/leaflet-setup";
import MapResizer from "@/components/MapResizer";

setupLeaflet();

interface CustomLocationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (location: { lat: number; lng: number; name: string }) => void;
  initialLocation?: { lat: number; lng: number; name?: string } | null;
}

// Default fallback coordinates (e.g. Minya Creativa region)
const DEFAULT_LAT = 28.0933;
const DEFAULT_LNG = 30.7505;

function ClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function CustomLocationPickerModal({
  open,
  onClose,
  onSave,
  initialLocation,
}: CustomLocationPickerModalProps) {
  const [lat, setLat] = useState<number>(initialLocation?.lat || DEFAULT_LAT);
  const [lng, setLng] = useState<number>(initialLocation?.lng || DEFAULT_LNG);
  const [name, setName] = useState<string>(initialLocation?.name || "");
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (initialLocation) {
      setLat(initialLocation.lat);
      setLng(initialLocation.lng);
      setName(initialLocation.name || "");
    }
  }, [initialLocation, open]);

  // Handle current GPS positioning
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        console.warn("[CustomLocationPicker] GPS error:", err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleLocationSelect = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  };

  const handleSave = () => {
    onSave({
      lat,
      lng,
      name: name.trim() || "موقع مخصص",
    });
    onClose();
  };

  const markerPosition = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg w-[92vw] rounded-3xl p-5 gap-4 bg-background max-h-[90vh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            تحديد نقطة تجمع مخصصة
          </DialogTitle>
          <DialogDescription className="text-right text-xs text-muted-foreground">
            حدد موقع الانتظار الدقيق على الخريطة واكتب اسماً مخصصاً للموقع.
          </DialogDescription>
        </DialogHeader>

        {/* Map Box */}
        <div className="relative w-full h-[260px] sm:h-[300px] rounded-2xl overflow-hidden border border-border shadow-inner">
          {open && (
            <MapContainer
              center={markerPosition}
              zoom={15}
              style={{ height: "100%", width: "100%", zIndex: 0 }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapResizer />
              <ClickHandler onLocationSelect={handleLocationSelect} />
              <Marker
                position={markerPosition}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng();
                    setLat(m.lat);
                    setLng(m.lng);
                  },
                }}
              />
            </MapContainer>
          )}

          {/* GPS Quick Button */}
          <button
            type="button"
            onClick={handleUseCurrentGPS}
            disabled={isLocating}
            className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-md border border-border shadow-md px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-card transition-all"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-primary" />
            )}
            موقعي الحالي
          </button>
        </div>

        {/* Custom Location Name Input */}
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="custom-location-name" className="text-xs font-bold text-foreground">
            اسم نقطة التجمع المخصصة (مثال: محطة البنزين، بوابة الجامعة، مسجد السلام)
          </Label>
          <Input
            id="custom-location-name"
            placeholder="مثال: أمام محطة البنزين"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            إلغاء
          </Button>
          <Button onClick={handleSave} className="rounded-xl font-semibold gap-1.5">
            <Check className="w-4 h-4" />
            حفظ نقطة التجمع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
