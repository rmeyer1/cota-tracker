import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Route } from "./useTrackerData";

export interface RouteShapePoint {
  lat: number;
  lon: number;
}

export interface RouteShape {
  routeId: string;
  routeColor: string;
  routeName: string;
  points: RouteShapePoint[];
}

interface RouteShapeResponse {
  route: {
    routeId: string;
    routeShortName: string;
    routeLongName: string;
    routeColor: string | null;
  };
  shapes: Record<string, RouteShapePoint[]>;
}

/**
 * Fetches route shape data for the selected route.
 * Returns derived route shape objects ready for the map.
 */
export function useSelectedRouteShape(
  selectedRouteId: string | null,
  routes: Route[]
): RouteShape[] {
  const { data, isLoading } = useQuery<RouteShapeResponse>({
    queryKey: ["/api/routes", selectedRouteId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/routes/${selectedRouteId}`);
      return res.json();
    },
    enabled: !!selectedRouteId,
  });

  if (!selectedRouteId || !data?.shapes) {
    return [];
  }

  const route = routes.find((r) => r.routeId === selectedRouteId);
  const routeColor = route?.routeColor || "2563eb";
  const routeName = route?.routeShortName || selectedRouteId;

  return Object.entries(data.shapes).map(([shapeId, points]) => ({
    routeId: selectedRouteId,
    routeColor,
    routeName,
    points,
  }));
}
