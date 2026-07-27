import { useEffect, useState } from "react";

interface TrackMapProps {
  busLocation: [number, number] | null;
}

export default function ClientTrackMap(props: TrackMapProps) {
  const [MapComp, setMapComp] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("./TrackMap")
      .then((mod) => {
        setMapComp(() => mod.default);
      })
      .catch((err) => {
        console.error("Failed to load map:", err);
        setError("Failed to load map");
      });
  }, []);

  if (error)
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-red-500">
        {error}
      </div>
    );
  if (!MapComp)
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        جاري تحميل الخريطة...
      </div>
    );

  return <MapComp {...props} />;
}
