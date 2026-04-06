import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Navigation, Bus, ChevronRight } from "lucide-react";
import { formatDistance } from "@/lib/utils";

interface ETAPanelProps {
  userLat: number;
  userLon: number;
  selectedStopId?: string | null;
}

interface NearbyResult {
  stop: {
    stopId: string;
    stopName: string;
    lat: number;
    lon: number;
    distanceMeters: number;
    walkMinutes: number;
  };
  vehicles: {
    vehicleId: string;
    routeId: string;
    routeName: string;
    routeColor: string;
    etaMinutes: number;
    distanceMeters: number;
    bearing: number;
  }[];
}

export default function ETAPanel({ userLat, userLon, selectedStopId }: ETAPanelProps) {
  const { data, isLoading, error } = useQuery<{ results: NearbyResult[] }>({
    queryKey: ["/api/eta", userLat, userLon, selectedStopId],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(userLat),
        lon: String(userLon),
      });
      if (selectedStopId) params.set("stopId", selectedStopId);
      const res = await apiRequest("GET", `/api/eta?${params}`);
      return res.json();
    },
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" data-testid="eta-loading">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-muted-foreground" data-testid="eta-error">
        <Bus className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Unable to load arrival times</p>
      </div>
    );
  }

  const results = data?.results || [];

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground" data-testid="eta-empty">
        <Navigation className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No nearby stops found</p>
        <p className="text-xs mt-1">Try zooming out or moving the map</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4" data-testid="eta-panel">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Live Arrivals
        </span>
      </div>

      {results.map((result) => (
        <Card
          key={result.stop.stopId}
          className="p-3 hover:bg-muted/40 transition-colors cursor-default"
          data-testid={`eta-card-${result.stop.stopId}`}
        >
          {/* Stop header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-tight truncate">
                  {result.stop.stopName}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {formatDistance(result.stop.distanceMeters)} away
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {result.stop.walkMinutes} min walk
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Arriving buses */}
          {result.vehicles.length > 0 ? (
            <div className="space-y-1.5 mt-2">
              {result.vehicles.map((v) => (
                <div
                  key={v.vehicleId}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30"
                  data-testid={`eta-vehicle-${v.vehicleId}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      className="text-xs font-bold px-2 py-0.5"
                      style={{
                        backgroundColor: `#${v.routeColor || "2563eb"}`,
                        color: "white",
                        borderColor: "transparent",
                      }}
                    >
                      {v.routeName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistance(v.distanceMeters)} away
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span
                      className={`text-sm font-bold ${
                        v.etaMinutes <= 3
                          ? "text-green-500"
                          : v.etaMinutes <= 10
                          ? "text-yellow-500"
                          : "text-foreground"
                      }`}
                    >
                      {v.etaMinutes <= 0 ? "Now" : `${v.etaMinutes} min`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1 pl-6">
              No buses approaching
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
