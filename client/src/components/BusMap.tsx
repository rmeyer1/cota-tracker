import { useEffect, useRef } from "react";
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

export interface MapControls {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
}

export interface TrafficIncident {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  roadName: string;
  severity: string;
  type: string;
  isRoadClosed: boolean;
}

interface BusMapProps {
  vehicles: Vehicle[];
  routeShapes: RouteShape[];
  userLocation: { latitude: number; longitude: number } | null;
  selectedRouteId: string | null;
  onVehicleClick?: (vehicle: Vehicle) => void;
  theme: "light" | "dark";
  routeColorMap: Map<string, string>;
  onMapReady?: (controls: MapControls) => void;
  trafficIncidents?: TrafficIncident[];
}

// Tracked state per vehicle for smooth animation
interface TrackedVehicle {
  marker: L.Marker;
  // Where we're animating FROM
  fromLat: number;
  fromLon: number;
  // Where we're animating TO (target)
  toLat: number;
  toLon: number;
  // Current displayed position
  currentLat: number;
  currentLon: number;
  // Animation timing
  animStartTime: number;
  animDuration: number; // ms
  // Last known data
  routeId: string;
  color: string;
}

const ANIM_DURATION = 4000; // smooth glide over 4 seconds

function buildBusIcon(color: string, routeLabel: string, vehicleId: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="bus-marker-pin">
      <svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="bs${vehicleId.replace(/\W/g, '')}" x="-2" y="0" width="44" height="60">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
          </filter>
        </defs>
        <g filter="url(#bs${vehicleId.replace(/\W/g, '')})">
          <polygon points="20,52 14,42 26,42" fill="#${color}"/>
          <rect x="4" y="2" width="32" height="40" rx="7" fill="#${color}"/>
          <rect x="4" y="2" width="32" height="40" rx="7" stroke="white" stroke-width="2" fill="none"/>
          <rect x="8" y="5" width="24" height="9" rx="3" fill="white" opacity="0.88"/>
          <rect x="9" y="17" width="9" height="6" rx="1.5" fill="white" opacity="0.4"/>
          <rect x="22" y="17" width="9" height="6" rx="1.5" fill="white" opacity="0.4"/>
          <circle cx="10" cy="4" r="1.8" fill="#FFECB3"/>
          <circle cx="30" cy="4" r="1.8" fill="#FFECB3"/>
          <rect x="2" y="28" width="5" height="8" rx="2.5" fill="#222"/>
          <rect x="33" y="28" width="5" height="8" rx="2.5" fill="#222"/>
          <rect x="9" y="37" width="5" height="2.5" rx="1.25" fill="#EF5350" opacity="0.8"/>
          <rect x="26" y="37" width="5" height="2.5" rx="1.25" fill="#EF5350" opacity="0.8"/>
        </g>
        <text x="20" y="32" text-anchor="middle" font-size="11" font-weight="800" fill="white" font-family="system-ui,sans-serif" letter-spacing="-0.5">${routeLabel}</text>
      </svg>
    </div>`,
    iconSize: [40, 56],
    iconAnchor: [20, 56],
  });
}

export default function BusMap({
  vehicles,
  routeShapes,
  userLocation,
  selectedRouteId,
  onVehicleClick,
  theme,
  routeColorMap,
  onMapReady,
  trafficIncidents = [],
}: BusMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef<Map<string, TrackedVehicle>>(new Map());
  const shapeLayersRef = useRef<L.Polyline[]>([]);
  const incidentMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const initialSetRef = useRef(false);
  const rafRef = useRef<number>(0);

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
      // Ensure touch zoom works well on mobile
      touchZoom: true,
      bounceAtZoomLimits: true,
    });

    mapRef.current = map;

    // Expose controls to parent
    onMapReady?.({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      recenter: () => {
        if (userLocation) {
          map.flyTo([userLocation.latitude, userLocation.longitude], 15, { duration: 0.8 });
        }
      },
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

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

  // Center on user once
  useEffect(() => {
    if (!mapRef.current || !userLocation || initialSetRef.current) return;
    mapRef.current.setView([userLocation.latitude, userLocation.longitude], 13);
    initialSetRef.current = true;
  }, [userLocation]);

  // User marker
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

  // Route shapes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    shapeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    shapeLayersRef.current = [];
    routeShapes.forEach((shape) => {
      const latlngs = shape.points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
      if (latlngs.length === 0) return;
      const polyline = L.polyline(latlngs, {
        color: `#${shape.routeColor || "2563eb"}`,
        weight: 4,
        opacity: 0.7,
      }).addTo(map);
      shapeLayersRef.current.push(polyline);
    });
  }, [routeShapes]);

  // When new vehicle data arrives: set animation targets (don't move markers yet)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filteredVehicles = selectedRouteId
      ? vehicles.filter((v) => v.routeId === selectedRouteId)
      : vehicles;

    const currentIds = new Set(filteredVehicles.map((v) => v.vehicleId));
    const now = performance.now();

    // Remove markers for vehicles no longer in feed
    trackedRef.current.forEach((tv, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(tv.marker);
        trackedRef.current.delete(id);
      }
    });

    // Add or update animation targets
    filteredVehicles.forEach((v) => {
      const color = routeColorMap.get(v.routeId) || "2563eb";
      const routeLabel = v.routeId.replace(/^0+/, "").slice(0, 4);
      const existing = trackedRef.current.get(v.vehicleId);

      if (existing) {
        // Only start new animation if position actually changed
        const dist = Math.abs(existing.toLat - v.latitude) + Math.abs(existing.toLon - v.longitude);
        if (dist > 0.000001) {
          // Snap "from" to wherever we currently are (mid-animation)
          existing.fromLat = existing.currentLat;
          existing.fromLon = existing.currentLon;
          existing.toLat = v.latitude;
          existing.toLon = v.longitude;
          existing.animStartTime = now;
          existing.animDuration = ANIM_DURATION;
        }
        // Update icon if route changed
        if (existing.routeId !== v.routeId || existing.color !== color) {
          existing.marker.setIcon(buildBusIcon(color, routeLabel, v.vehicleId));
          existing.routeId = v.routeId;
          existing.color = color;
        }
        // Update popup content
        existing.marker.setPopupContent(
          `<div style="font-family:var(--font-sans);font-size:13px;">
            <div style="font-weight:700;font-size:14px;">Route ${v.routeId}</div>
            <div style="color:#888;">Vehicle ${v.label || v.vehicleId}</div>
            <div style="margin-top:4px;">Status: ${v.currentStatus.replace(/_/g, " ")}</div>
            ${v.speed > 0 ? `<div>Speed: ${Math.round(v.speed * 2.237)} mph</div>` : ""}
          </div>`
        );
      } else {
        // New vehicle — create marker at its position
        const icon = buildBusIcon(color, routeLabel, v.vehicleId);
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

        trackedRef.current.set(v.vehicleId, {
          marker,
          fromLat: v.latitude,
          fromLon: v.longitude,
          toLat: v.latitude,
          toLon: v.longitude,
          currentLat: v.latitude,
          currentLon: v.longitude,
          animStartTime: now,
          animDuration: ANIM_DURATION,
          routeId: v.routeId,
          color,
        });
      }
    });
  }, [vehicles, selectedRouteId, routeColorMap, onVehicleClick]);

  // Traffic incident markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old incident markers
    incidentMarkersRef.current.forEach((m) => map.removeLayer(m));
    incidentMarkersRef.current = [];

    trafficIncidents.forEach((incident) => {
      const isClosed = incident.isRoadClosed;
      const icon = L.divIcon({
        className: "",
        html: `<div class="traffic-incident-marker ${isClosed ? 'road-closed' : ''}" title="${incident.description.replace(/"/g, '&quot;')}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,20 2,20" fill="${isClosed ? '#EF4444' : '#F59E0B'}" stroke="white" stroke-width="1.5"/>
            <text x="12" y="17" text-anchor="middle" font-size="12" font-weight="900" fill="white">!</text>
          </svg>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 20],
      });

      const marker = L.marker([incident.latitude, incident.longitude], {
        icon,
        zIndexOffset: 400,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:var(--font-sans);font-size:13px;max-width:220px;">
            <div style="font-weight:700;font-size:13px;color:${isClosed ? '#EF4444' : '#F59E0B'};">
              ${isClosed ? '🚧 Road Closed' : '⚠️ Traffic Incident'}
            </div>
            <div style="font-weight:600;margin-top:2px;">${incident.roadName}</div>
            <div style="color:#888;margin-top:4px;font-size:12px;">${incident.description}</div>
          </div>`
        );

      incidentMarkersRef.current.push(marker);
    });
  }, [trafficIncidents]);

  // Animation loop — runs continuously, smoothly interpolating all markers
  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;
      const now = performance.now();

      trackedRef.current.forEach((tv) => {
        const elapsed = now - tv.animStartTime;
        // Ease-out cubic for natural deceleration
        const rawT = Math.min(elapsed / tv.animDuration, 1);
        const t = 1 - Math.pow(1 - rawT, 3);

        const lat = tv.fromLat + (tv.toLat - tv.fromLat) * t;
        const lon = tv.fromLon + (tv.toLon - tv.fromLon) * t;

        // Only call setLatLng if position actually changed (avoid unnecessary DOM updates)
        if (Math.abs(lat - tv.currentLat) > 0.0000001 || Math.abs(lon - tv.currentLon) > 0.0000001) {
          tv.currentLat = lat;
          tv.currentLon = lon;
          tv.marker.setLatLng([lat, lon]);
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-testid="bus-map"
    />
  );
}
