import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bus, X } from "lucide-react";

interface Route {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string | null;
}

interface RouteSelectorProps {
  routes: Route[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string | null) => void;
  vehicleCounts: Record<string, number>;
}

export default function RouteSelector({
  routes,
  selectedRouteId,
  onSelectRoute,
  vehicleCounts,
}: RouteSelectorProps) {
  // Sort routes by short name (numerically if possible)
  const sortedRoutes = [...routes].sort((a, b) => {
    const aNum = parseInt(a.routeShortName);
    const bNum = parseInt(b.routeShortName);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.routeShortName.localeCompare(b.routeShortName);
  });

  // Filter to only routes with active vehicles
  const activeRoutes = sortedRoutes.filter(
    (r) => (vehicleCounts[r.routeId] || 0) > 0
  );
  const inactiveRoutes = sortedRoutes.filter(
    (r) => (vehicleCounts[r.routeId] || 0) === 0
  );

  return (
    <div className="p-4" data-testid="route-selector">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Routes</h2>
        {selectedRouteId && (
          <button
            onClick={() => onSelectRoute(null)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            data-testid="clear-route-filter"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-520px)] min-h-[200px]">
        {/* Active routes */}
        {activeRoutes.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              Active ({activeRoutes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeRoutes.map((route) => {
                const isSelected = selectedRouteId === route.routeId;
                const count = vehicleCounts[route.routeId] || 0;
                return (
                  <button
                    key={route.routeId}
                    onClick={() =>
                      onSelectRoute(isSelected ? null : route.routeId)
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105"
                        : "hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: `#${route.routeColor || "2563eb"}`,
                      color: "white",
                    }}
                    data-testid={`route-btn-${route.routeId}`}
                    title={`${route.routeLongName} (${count} buses)`}
                  >
                    <Bus className="w-3 h-3" />
                    {route.routeShortName}
                    <span className="opacity-70 ml-0.5">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inactive routes */}
        {inactiveRoutes.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              Not Running ({inactiveRoutes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inactiveRoutes.map((route) => (
                <Badge
                  key={route.routeId}
                  variant="secondary"
                  className="text-xs opacity-50 cursor-default"
                >
                  {route.routeShortName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
