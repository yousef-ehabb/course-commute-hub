import { useEffect, useState } from "react";
import type { Station } from "@/contexts/StationsContext";

interface AdminStationsMapProps {
  stations: Station[];
  onAddStation?: (lat: number, lng: number) => void;
  activeStationId?: string | null;
}

export default function ClientAdminStationsMap(props: AdminStationsMapProps) {
  const [MapComp, setMapComp] = useState<any>(null);

  useEffect(() => {
    import("./AdminStationsMap").then((mod) => setMapComp(() => mod.default));
  }, []);

  if (!MapComp)
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500">
        جاري تحميل الخريطة...
      </div>
    );
  return <MapComp {...props} />;
}
