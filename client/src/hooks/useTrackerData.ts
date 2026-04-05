import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
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

interface VehicleUpdateMessage {
  type: "vehicle_update";
  timestamp: number;
  vehicles: Vehicle[];
  vehicleCount: number;
}

interface HeartbeatMessage {
  type: "heartbeat";
  timestamp: number;
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

const REFETCH_INTERVAL = 15000; // GTFS-RT feed SLA
const WS_RECONNECT_INTERVAL = 3000;

export function useTrackerData(): TrackerDataReturn {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsConnectedRef = useRef(false);

  // Connect to WebSocket for real-time vehicle updates
  const connectWebSocket = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/vehicles`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to vehicle updates");
        wsConnectedRef.current = true;
        queryClient.setQueryDefaults(["/api/vehicles"], { refetchInterval: false });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as VehicleUpdateMessage | HeartbeatMessage;
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
        console.log("[WS] Disconnected, reconnecting...");
        wsConnectedRef.current = false;
        wsRef.current = null;
        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, WS_RECONNECT_INTERVAL);
      };

      ws.onerror = () => {
        console.warn("[WS] Connection error, falling back to polling");
        wsConnectedRef.current = false;
      };
    } catch (e) {
      console.warn("[WS] Failed to create WebSocket, using polling fallback");
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

  // Fetch real-time vehicles (fallback when WebSocket unavailable)
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    dataUpdatedAt,
  } = useQuery<VehiclesResponse>({
    queryKey: ["/api/vehicles"],
    // Keep polling as fallback when WebSocket isn't connected
    refetchInterval: wsConnectedRef.current ? false : REFETCH_INTERVAL,
  });

  // Fetch traffic incidents & cameras
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
    wsConnected: wsConnectedRef.current,
  };
}
