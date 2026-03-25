import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Vehicle {
  vehicleId: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  timestamp: number;
  label: string;
  currentStatus: string;
}

interface RouteShape {
  routeId: string;
  routeColor: string;
  routeName: string;
  points: { lat: number; lon: number }[];
}

interface BusMapProps {
  vehicles: Vehicle[];
  routeShapes: RouteShape[];
  userLocation: { latitude: number; longitude: number } | null;
  selectedRouteId: string | null;
  onVehicleClick?: (vehicle: Vehicle) => void;
  theme: "light" | "dark";
  routeColorMap: Map<string, string>;
}

export default function BusMap({
  vehicles,
  routeShapes,
  userLocation,
  selectedRouteId,
  onVehicleClick,
  theme,
  routeColorMap,
}: BusMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const shapeLayersRef = useRef<L.Polyline[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const initialSetRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: L.LatLngExpression = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [39.9612, -82.9988];

    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // Add zoom control to bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update tile layer when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
  }, [theme]);

  // Center map on user location once
  useEffect(() => {
    if (!mapRef.current || !userLocation || initialSetRef.current) return;
    mapRef.current.setView(
      [userLocation.latitude, userLocation.longitude],
      13
    );
    initialSetRef.current = true;
  }, [userLocation]);

  // Update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="user-marker"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      userMarkerRef.current = L.marker(
        [userLocation.latitude, userLocation.longitude],
        { icon, zIndexOffset: 1000 }
      )
        .addTo(map)
        .bindPopup("<strong>Your Location</strong>");
    }
  }, [userLocation]);

  // Update route shapes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old shapes
    shapeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    shapeLayersRef.current = [];

    // Add new shapes
    routeShapes.forEach((shape) => {
      const latlngs = shape.points.map(
        (p) => [p.lat, p.lon] as L.LatLngTuple
      );
      if (latlngs.length === 0) return;

      const polyline = L.polyline(latlngs, {
        color: `#${shape.routeColor || "2563eb"}`,
        weight: 4,
        opacity: 0.7,
      }).addTo(map);

      shapeLayersRef.current.push(polyline);
    });
  }, [routeShapes]);

  // Update vehicle markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filteredVehicles = selectedRouteId
      ? vehicles.filter((v) => v.routeId === selectedRouteId)
      : vehicles;

    const currentIds = new Set(filteredVehicles.map((v) => v.vehicleId));

    // Remove markers for vehicles no longer present
    vehicleMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        vehicleMarkersRef.current.delete(id);
      }
    });

    // Add/update markers
    filteredVehicles.forEach((v) => {
      const color = routeColorMap.get(v.routeId) || "2563eb";
      const routeLabel = v.routeId.replace(/^0+/, '').slice(0, 4);
      const bearing = v.bearing || 0;

      const icon = L.divIcon({
        className: "",
        html: `<div class="bus-marker-pin">
          <svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Drop shadow -->
            <defs>
              <filter id="bs${v.vehicleId.replace(/\W/g,'')}" x="-2" y="0" width="44" height="60">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
              </filter>
            </defs>
            <g filter="url(#bs${v.vehicleId.replace(/\W/g,'')})">
              <!-- Pin pointer -->
              <polygon points="20,52 14,42 26,42" fill="#${color}"/>
              <!-- Bus body (rounded rect) -->
              <rect x="4" y="2" width="32" height="40" rx="7" fill="#${color}"/>
              <rect x="4" y="2" width="32" height="40" rx="7" stroke="white" stroke-width="2" fill="none"/>
              <!-- Windshield -->
              <rect x="8" y="5" width="24" height="9" rx="3" fill="white" opacity="0.88"/>
              <!-- Side windows row -->
              <rect x="9" y="17" width="9" height="6" rx="1.5" fill="white" opacity="0.4"/>
              <rect x="22" y="17" width="9" height="6" rx="1.5" fill="white" opacity="0.4"/>
              <!-- Headlights -->
              <circle cx="10" cy="4" r="1.8" fill="#FFECB3"/>
              <circle cx="30" cy="4" r="1.8" fill="#FFECB3"/>
              <!-- Wheels -->
              <rect x="2" y="28" width="5" height="8" rx="2.5" fill="#222"/>
              <rect x="33" y="28" width="5" height="8" rx="2.5" fill="#222"/>
              <!-- Taillights -->
              <rect x="9" y="37" width="5" height="2.5" rx="1.25" fill="#EF5350" opacity="0.8"/>
              <rect x="26" y="37" width="5" height="2.5" rx="1.25" fill="#EF5350" opacity="0.8"/>
            </g>
            <!-- Route number -->
            <text x="20" y="32" text-anchor="middle" font-size="11" font-weight="800" fill="white" font-family="system-ui,sans-serif" letter-spacing="-0.5">${routeLabel}</text>
          </svg>
        </div>`,
        iconSize: [40, 56],
        iconAnchor: [20, 56],
      });

      const existing = vehicleMarkersRef.current.get(v.vehicleId);
      if (existing) {
        existing.setLatLng([v.latitude, v.longitude]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([v.latitude, v.longitude], {
          icon,
          zIndexOffset: 500,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:var(--font-sans);font-size:13px;">
              <div style="font-weight:700;font-size:14px;">Route ${v.routeId}</div>
              <div style="color:#888;">Vehicle ${v.label || v.vehicleId}</div>
              <div style="margin-top:4px;">Status: ${v.currentStatus.replace(/_/g, " ")}</div>
              ${v.speed > 0 ? `<div>Speed: ${Math.round(v.speed * 2.237)} mph</div>` : ""}
            </div>`
          );

        marker.on("click", () => onVehicleClick?.(v));
        vehicleMarkersRef.current.set(v.vehicleId, marker);
      }
    });
  }, [vehicles, selectedRouteId, routeColorMap, onVehicleClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-testid="bus-map"
    />
  );
}
