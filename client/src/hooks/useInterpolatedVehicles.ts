import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface InterpolatedVehicle {
  vehicleId: string;
  tripId: string;
  routeId: string;
  currentPosition: {
    lat: number;
    lon: number;
    bearing: number;
  };
  previousPosition: {
    lat: number;
    lon: number;
    bearing: number;
    timestamp: number;
  };
  nextPosition: {
    lat: number;
    lon: number;
    bearing: number;
    timestamp: number;
  } | null;
  progress: number;
  speed: number;
  isInterpolated: boolean;
  shapeId: string | null;
}

export interface InterpolatedVehiclesResponse {
  vehicles: InterpolatedVehicle[];
  shapes: Record<string, { lat: number; lon: number }[]>;
  timestamp: number;
  count: number;
}

/**
 * Hook for fetching vehicles with route-based interpolation
 * Use this when you need smooth bus animations along actual route shapes
 */
export function useInterpolatedVehicles(routeId: string | null, refetchInterval = 10000) {
  return useQuery<InterpolatedVehiclesResponse>({
    queryKey: ["/api/vehicles/interpolated", routeId],
    queryFn: async () => {
      if (!routeId) {
        return { vehicles: [], shapes: {}, timestamp: Date.now(), count: 0 };
      }
      const res = await apiRequest("GET", `/api/vehicles/interpolated/${routeId}`);
      return res.json();
    },
    enabled: !!routeId,
    refetchInterval,
    staleTime: 5000,
  });
}

/**
 * Hook for fetching route shapes only
 */
export function useRouteShapes(routeId: string | null) {
  return useQuery<{ shapes: Record<string, { lat: number; lon: number }[]>; count: number }>({
    queryKey: ["/api/shapes", routeId],
    queryFn: async () => {
      if (!routeId) {
        return { shapes: {}, count: 0 };
      }
      const res = await apiRequest("GET", `/api/shapes/${routeId}`);
      return res.json();
    },
    enabled: !!routeId,
  });
}
