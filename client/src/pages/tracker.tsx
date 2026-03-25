import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import BusMap from "@/components/BusMap";
import ETAPanel from "@/components/ETAPanel";
import RouteSelector from "@/components/RouteSelector";
import { useUserLocation } from "@/hooks/use-location";
import { useTheme } from "@/hooks/use-theme";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bus,
  MapPin,
  Navigation,
  Sun,
  Moon,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Locate,
} from "lucide-react";

export default function TrackerPage() {
  const { location: userLocation } = useUserLocation();
  const { theme, toggleTheme } = useTheme();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Fetch all routes
  const { data: routesData } = useQuery<{
    routes: {
      routeId: string;
      routeShortName: string;
      routeLongName: string;
      routeColor: string | null;
      routeTextColor: string | null;
    }[];
  }>({
    queryKey: ["/api/routes"],
  });

  // Fetch real-time vehicles
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    dataUpdatedAt,
  } = useQuery<{
    vehicles: {
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
    }[];
    lastUpdated: number;
    count: number;
  }>({
    queryKey: ["/api/vehicles"],
    refetchInterval: 5000,
  });

  // Fetch route shapes when a route is selected
  const { data: routeShapeData } = useQuery<{
    route: any;
    shapes: Record<string, { lat: number; lon: number }[]>;
  }>({
    queryKey: ["/api/routes", selectedRouteId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/routes/${selectedRouteId}`);
      return res.json();
    },
    enabled: !!selectedRouteId,
  });

  const vehicles = vehiclesData?.vehicles || [];
  const routes = routesData?.routes || [];

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

  // Build route shapes for the map
  const routeShapes = useMemo(() => {
    if (!selectedRouteId || !routeShapeData?.shapes) return [];
    const route = routesData?.routes?.find((r) => r.routeId === selectedRouteId);
    return Object.entries(routeShapeData.shapes).map(([shapeId, points]) => ({
      routeId: selectedRouteId,
      routeColor: route?.routeColor || "2563eb",
      routeName: route?.routeShortName || selectedRouteId,
      points,
    }));
  }, [selectedRouteId, routeShapeData, routesData]);

  // Time since last update
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const lastUpdateText = useMemo(() => {
    if (!dataUpdatedAt) return "";
    const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }, [dataUpdatedAt, /* eslint-disable-line */]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" data-testid="tracker-page">
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-card border-b border-border z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="COTA Tracker">
              <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
              <path
                d="M8 22V14a8 8 0 0116 0v8"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="22" r="2.5" fill="white" />
              <circle cx="20" cy="22" r="2.5" fill="white" />
              <rect x="10" y="11" width="12" height="5" rx="1.5" fill="white" opacity="0.4" />
            </svg>
            <div>
              <h1 className="text-sm font-bold leading-none">COTA Tracker</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Columbus Transit · Live
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-xs text-muted-foreground">
              {vehicles.length} buses · {lastUpdateText}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleTheme}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map takes full width */}
        <div className="flex-1 relative">
          {vehiclesLoading && vehicles.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading COTA data...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Downloading routes and real-time positions
                </p>
              </div>
            </div>
          ) : (
            <BusMap
              vehicles={vehicles}
              routeShapes={routeShapes}
              userLocation={userLocation}
              selectedRouteId={selectedRouteId}
              theme={theme}
              routeColorMap={routeColorMap}
            />
          )}

          {/* Mobile bottom sheet toggle */}
          <button
            className="absolute bottom-4 left-1/2 -translate-x-1/2 md:hidden z-[1000] bg-card border border-border rounded-full px-4 py-2 shadow-lg flex items-center gap-2"
            onClick={() => setPanelOpen(!panelOpen)}
            data-testid="toggle-panel"
          >
            {panelOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
            <span className="text-xs font-medium">
              {panelOpen ? "Hide" : "Nearby Buses"}
            </span>
          </button>
        </div>

        {/* Right sidebar (desktop) / Bottom sheet (mobile) */}
        <aside
          className={`
            absolute md:relative md:w-80 lg:w-96
            bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto
            bg-card border-t md:border-t-0 md:border-l border-border
            transition-transform duration-300 ease-out z-[999]
            ${panelOpen ? "translate-y-0" : "translate-y-full md:translate-y-0"}
            max-h-[60vh] md:max-h-none md:h-full
            overflow-y-auto
          `}
          data-testid="sidebar"
        >
          {/* Route selector */}
          <RouteSelector
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            vehicleCounts={vehicleCounts}
          />

          {/* Divider */}
          <div className="border-t border-border" />

          {/* ETA Panel */}
          {userLocation && (
            <ETAPanel
              userLat={userLocation.latitude}
              userLon={userLocation.longitude}
            />
          )}

          {/* Attribution */}
          <div className="p-4 border-t border-border">
            <PerplexityAttribution />
          </div>
        </aside>
      </div>
    </div>
  );
}
