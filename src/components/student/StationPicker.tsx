import { useState } from "react";
import { Drawer } from "vaul";
import { MapPin, Check, ChevronDown, Plus } from "lucide-react";
import { getStationName } from "@/utils/stationResolver";
import type { Station } from "@/contexts/StationsContext";
import { CustomLocationPickerModal } from "./CustomLocationPickerModal";

interface StationPickerProps {
  currentStationId: string;
  customLocationName?: string | null;
  customLocationCoords?: { lat: number; lng: number } | null;
  stations: Station[];
  onChange: (stationId: string, customLocation?: { lat: number; lng: number; name: string }) => void;
  disabled?: boolean;
}

export function StationPicker({
  currentStationId,
  customLocationName,
  customLocationCoords,
  stations,
  onChange,
  disabled,
}: StationPickerProps) {
  const [open, setOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const isInvalid =
    !!currentStationId &&
    currentStationId !== "custom" &&
    !stations.find((s) => s.id === currentStationId);

  const displayStationName = getStationName(currentStationId, stations, customLocationName);

  return (
    <>
      <Drawer.Root open={open} onOpenChange={setOpen} direction="bottom">
        <Drawer.Trigger asChild>
          <button
            disabled={disabled}
            className={`w-full rounded-2xl p-4 flex items-center justify-between shadow-card transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-elevated ${isInvalid ? "bg-destructive/5 ring-1 ring-destructive" : "bg-card"}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                <MapPin className="w-5 h-5" strokeWidth={1.8} />
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground font-medium">نقطة التجمع</div>
                <div
                  className={`text-[15px] font-semibold ${isInvalid ? "text-destructive" : "text-foreground"}`}
                >
                  {displayStationName}
                </div>
              </div>
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
          </button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
          <Drawer.Content className="bg-background flex flex-col rounded-t-3xl mt-24 fixed bottom-0 left-0 right-0 z-50 max-h-[85vh]">
            <div className="p-5 bg-card rounded-t-3xl flex-1">
              <div className="mx-auto w-10 h-1 flex-shrink-0 rounded-full bg-muted mb-6" />
              <div className="max-w-md mx-auto">
                <Drawer.Title className="font-bold text-lg mb-1">تحديد نقطة التجمع</Drawer.Title>
                <Drawer.Description className="text-[13px] text-muted-foreground mb-5">
                  اختر نقطة تجمع من القائمة أو حدد موقعك المخصص على الخريطة
                </Drawer.Description>

                <div className="space-y-2 overflow-y-auto max-h-[45vh] pr-1">
                  {/* Custom location option */}
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowCustomModal(true);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-150 ${
                      currentStationId === "custom"
                        ? "bg-primary/6 ring-1 ring-primary/20"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-primary" strokeWidth={2} />
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-foreground">
                          {currentStationId === "custom" && customLocationName
                            ? `نقطة مخصصة: ${customLocationName}`
                            : "تحديد نقطة تجمع مخصصة على الخريطة"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          تحديد مكان الانتظار الدقيق واسم الموقع على الخريطة
                        </div>
                      </div>
                    </div>
                    {currentStationId === "custom" && (
                      <Check className="w-5 h-5 text-primary" strokeWidth={2} />
                    )}
                  </button>

                  <div className="h-px bg-border/50 my-2" />

                  {stations.map((station) => (
                    <button
                      key={station.id}
                      onClick={() => {
                        onChange(station.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-150 ${
                        currentStationId === station.id
                          ? "bg-primary/6 ring-1 ring-primary/20"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-foreground">
                          {station.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          التحرك: {station.time}
                        </div>
                      </div>
                      {currentStationId === station.id && (
                        <Check className="w-5 h-5 text-primary" strokeWidth={2} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Interactive Custom Location Pinning Modal */}
      <CustomLocationPickerModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        initialLocation={
          customLocationCoords
            ? { lat: customLocationCoords.lat, lng: customLocationCoords.lng, name: customLocationName || "" }
            : null
        }
        onSave={(location) => {
          onChange("custom", location);
        }}
      />
    </>
  );
}
