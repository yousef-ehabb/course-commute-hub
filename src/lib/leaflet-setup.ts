import L from "leaflet";
import "leaflet/dist/leaflet.css";

// This file centralizes Leaflet's configuration to avoid duplicating it across components.

let isSetup = false;

// Fix Leaflet's default icon path issues in React
export function setupLeaflet() {
  if (isSetup) return;
  isSetup = true;

  if ((L.Icon.Default.prototype as any)._getIconUrl) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
  }
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}
