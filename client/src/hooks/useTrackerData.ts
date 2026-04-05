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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/vehicles`;

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

      ws.onerror = () => {
        // Let onclose handle cleanup
      };
    } catch (e) {
      console.warn("[WS] Failed to create WebSocket, using polling");
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
  } = useQuery<RoutesResponse>({
    queryKey: ["/api/routes"],
  });

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
  } = useQuery<TrafficData>({
    queryKey: ["/api/traffic"],
    refetchInterval: REFETCH_INTERVAL,
  });

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
