import type { Route } from "@/hooks/useTrackerData";
import RouteSelector from "@/components/RouteSelector";
import ETAPanel from "@/components/ETAPanel";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface TrackerSidebarProps {
  routes: Route[];
  selectedRouteId: string | null;
  vehicleCounts: Record<string, number>;
  userLocation: UserLocation | null;
  onSelectRoute: (routeId: string | null) => void;
  panelOpen: boolean;
}

export function TrackerSidebar({
  routes,
  selectedRouteId,
  vehicleCounts,
  userLocation,
  onSelectRoute,
  panelOpen,
}: TrackerSidebarProps) {
  return (
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
        onSelectRoute={onSelectRoute}
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
  );
}
