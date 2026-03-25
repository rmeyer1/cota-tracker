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

      const icon = L.divIcon({
        className: "",
        html: `<div class="bus-marker" style="width:30px;height:30px;background:#${color};font-size:10px;line-height:30px;text-align:center;">${routeLabel}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
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
