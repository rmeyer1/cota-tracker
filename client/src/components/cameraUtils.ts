import L from "leaflet";

export interface TrafficCamera {
  id: string;
  latitude: number;
  longitude: number;
  location: string;
  description: string;
  cameraViews: {
    direction: string;
    smallUrl: string;
    largeUrl: string;
    mainRoute: string;
  }[];
}

const CAMERA_SVG = (
  '<div class="traffic-camera-marker" title="Camera">' +
  '<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="2" y="2" width="24" height="18" rx="3" fill="#1e40af" stroke="white" stroke-width="1.5"/>' +
  '<circle cx="14" cy="11" r="3" fill="#60a5fa"/>' +
  '<circle cx="14" cy="11" r="1.5" fill="#1e3a8a"/>' +
  '<rect x="9" y="20" width="10" height="4" rx="1" fill="#1e40af"/>' +
  '<rect x="12" y="24" width="4" height="8" rx="1" fill="#1e40af"/>' +
  '<rect x="8" y="32" width="12" height="2" rx="1" fill="#374151"/>' +
  "</svg>" +
  "</div>"
);

function buildCameraIcon(title: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: CAMERA_SVG.replace("title=\"Camera\"", `title="${title.replace(/"/g, "&quot;")}"`),
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

function buildPopupContent(camera: TrafficCamera): string {
  const view = camera.cameraViews[0];
  const imgUrl = view?.smallUrl || "";
  const location = camera.location || "Traffic Camera";
  const mainRoute = view?.mainRoute || "";
  const direction = view?.direction || "";
  const description = camera.description || "";
  const largeUrl = view?.largeUrl || "";

  let html = `<div style="font-family:var(--font-sans);font-size:13px;max-width:260px;">`;
  html += `<div style="font-weight:700;font-size:13px;margin-bottom:4px;">${location}</div>`;

  if (imgUrl) {
    html += `<img src="${imgUrl}" alt="Traffic camera" style="width:100%;border-radius:6px;margin-bottom:6px;" loading="lazy" />`;
  }
  if (mainRoute) {
    html += `<div style="color:#666;font-size:12px;">Route: ${mainRoute}</div>`;
  }
  if (direction) {
    html += `<div style="color:#666;font-size:12px;">Direction: ${direction}</div>`;
  }
  if (description) {
    html += `<div style="color:#888;font-size:11px;margin-top:4px;">${description}</div>`;
  }
  if (largeUrl) {
    html += `<a href="${largeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:12px;color:#3b82f6;">View Live Feed →</a>`;
  }

  html += `</div>`;
  return html;
}

export function addCameraMarkers(
  map: L.Map,
  cameras: TrafficCamera[]
): L.Marker[] {
  return cameras.map((camera) => {
    const icon = buildCameraIcon(camera.location || "Camera");
    const marker = L.marker([camera.latitude, camera.longitude], {
      icon,
      zIndexOffset: 350,
    })
      .addTo(map)
      .bindPopup(buildPopupContent(camera), { maxWidth: 300 });

    return marker;
  });
}
