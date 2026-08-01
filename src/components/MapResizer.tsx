import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * A utility component for React-Leaflet that ensures the map correctly resizes
 * when its parent container's dimensions change.
 * 
 * This is especially critical for mobile browsers where the viewport (and flex layouts)
 * can dynamically change due to address bar collapse/expansion, preventing grey tiles.
 */
export default function MapResizer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Immediately invalidate size on mount & after layout renders
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // The actual DOM element of the map container
    const container = map.getContainer();

    // Use ResizeObserver to detect any dimension changes to the container
    const resizeObserver = new ResizeObserver(() => {
      // Invalidate size so Leaflet recalculates the tile grid
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}
