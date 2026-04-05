import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { TrafficIncident, TrafficCamera } from "@/components/BusMap";

export interface Route {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string | null;
  routeTextColor: string | null;
}

export interface Vehicle {
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

export interface TrafficData {
  incidents: TrafficIncident[];
  cameras: TrafficCamera[];
  enabled: boolean;
}

interface RoutesResponse {
  routes: Route[];
}

interface VehiclesResponse {
  vehicles: Vehicle[];
  lastUpdated: number;
  count: number;
}

interface TrackerDataReturn {
  routes: Route[];
  vehicles: Vehicle[];
  traffic: TrafficData;
  routesLoading: boolean;
  vehiclesLoading: boolean;
  trafficLoading: boolean;
  vehiclesDataUpdatedAt: number | undefined;
  wsConnected: boolean;
}

const REFETCH_INTERVAL = 15000; // GTFS-RT feed SLA — only used as polling fallback
const WS_RECONNECT_INTERVAL = 3000;

export function useTrackerData(): TrackerDataReturn {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React state so refetchInterval re-evaluates reactively when WS connects/disconnects
  const [wsConnected, setWsConnected] = useState(false);

 const connectWebSocket = useCallback(() => {
  // Don't connect if already connected or connecting
  if (
    wsRef.current?.readyState === WebSocket.OPEN ||
    wsRef.current?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  // ────── NEW: much more robust URL logic ──────
  let wsUrl = import.meta.env.VITE_WS_URL; // ← preferred (set in Vercel)

  // Fallback for local dev (if you didn't set VITE_WS_URL locally)
  if (!wsUrl) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl = `${protocol}//${window.location.host}/ws/vehicles`;
  }

  console.log("[WS] Connecting to:", wsUrl);

  try {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to vehicle updates");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "vehicle_update") {
          queryClient.setQueryData<VehiclesResponse>(["/api/vehicles"], {
            vehicles: data.vehicles,
            lastUpdated: data.timestamp,
            count: data.vehicleCount,
          });
        }
      } catch (e) {
        console.error("[WS] Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected, falling back to polling");
      setWsConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, WS_RECONNECT_INTERVAL);
    };

    ws.onerror = (err) => {
      console.error("[WS] WebSocket error:", err);
    };
  } catch (e) {
    console.warn("[WS] Failed to create WebSocket, using polling", e);
    setWsConnected(false);
  }
}, [queryClient]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Fetch all routes
  const {
    data: routesData,
    isLoading: routesLoading,
    error: routesError,
  } = useQuery<RoutesResponse>({
    queryKey: ["/api/routes"],
  });

  // Debug logging for routes
  useEffect(() => {
    console.log("[Debug Routes] Loading:", routesLoading);
    console.log("[Debug Routes] Data:", routesData);
    console.log("[Debug Routes] Error:", routesError);
    console.log("[Debug Routes] API_URL:", import.meta.env.VITE_API_URL);
    
    // Manual test fetch
    fetch('/api/routes')
      .then(r => {
        console.log("[Debug Routes] Manual fetch status:", r.status);
        return r.json();
      })
      .then(data => console.log("[Debug Routes] Manual fetch data:", data))
      .catch(err => console.error("[Debug Routes] Manual fetch error:", err));
  }, [routesData, routesLoading, routesError]);

  // Fetch real-time vehicles — only poll when WebSocket is NOT connected
  // When WS is connected, vehicle data arrives via setQueryData in onmessage
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    dataUpdatedAt,
  } = useQuery<VehiclesResponse>({
    queryKey: ["/api/vehicles"],
    // Only poll as fallback when WebSocket is unavailable
    refetchInterval: wsConnected ? false : REFETCH_INTERVAL,
    // Disable automatic refetch when WS is connected (WS message triggers update)
    enabled: !wsConnected,
  });

  // Fetch traffic incidents & cameras — no WebSocket for traffic, always poll
  const {
    data: trafficData,
    isLoading: trafficLoading,
    error: trafficError,
  } = useQuery<TrafficData>({
    queryKey: ["/api/traffic"],
    refetchInterval: REFETCH_INTERVAL,
  });

  // Debug logging for traffic
  useEffect(() => {
    console.log("[Debug Traffic] Loading:", trafficLoading);
    console.log("[Debug Traffic] Data:", trafficData);
    console.log("[Debug Traffic] Error:", trafficError);
  }, [trafficData, trafficLoading, trafficError]);

  return {
    routes: routesData?.routes || [],
    vehicles: vehiclesData?.vehicles || [],
    traffic: {
      incidents: trafficData?.incidents || [],
      cameras: trafficData?.cameras || [],
      enabled: trafficData?.enabled ?? true,
    },
    routesLoading,
    vehiclesLoading,
    trafficLoading,
    vehiclesDataUpdatedAt: dataUpdatedAt,
    wsConnected,
  };
}
