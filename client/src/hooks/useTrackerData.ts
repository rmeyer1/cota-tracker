import { useQuery } from "@tanstack/react-query";
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
}

const REFETCH_INTERVAL = 15000; // matches GTFS-RT feed SLA

export function useTrackerData(): TrackerDataReturn {
  // Fetch all routes
  const {
    data: routesData,
    isLoading: routesLoading,
  } = useQuery<RoutesResponse>({
    queryKey: ["/api/routes"],
  });

  // Fetch real-time vehicles
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    dataUpdatedAt,
  } = useQuery<VehiclesResponse>({
    queryKey: ["/api/vehicles"],
    refetchInterval: REFETCH_INTERVAL,
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
  };
}
