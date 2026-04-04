import { useMemo, useState, useEffect } from "react";
import type { Route, Vehicle } from "./useTrackerData";

/**
 * Derives presentation-layer state from raw vehicle/route data:
 * vehicle counts per route, color map, and last-update timestamp text.
 */
export function useVehiclePresentation(
  vehicles: Vehicle[],
  routes: Route[],
  dataUpdatedAt: number | undefined
) {
  // Count vehicles per route
  const vehicleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicles.forEach((v) => {
      counts[v.routeId] = (counts[v.routeId] || 0) + 1;
    });
    return counts;
  }, [vehicles]);

  // Build route color map
  const routeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    routes.forEach((r) => {
      if (r.routeColor) map.set(r.routeId, r.routeColor);
    });
    return map;
  }, [routes]);

  // Formatted "last update" text (e.g. "5s ago")
  const lastUpdateText = useMemo(() => {
    if (!dataUpdatedAt) return "";
    const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }, [dataUpdatedAt]);

  // Tick state to force re-render every 10s so "last update" text stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  return { vehicleCounts, routeColorMap, lastUpdateText };
}
