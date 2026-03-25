import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X, ChevronDown, ChevronUp, Bus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ServiceAlert {
  id: string;
  headerText: string;
  descriptionText: string;
  cause: string;
  effect: string;
  routeIds: string[];
  stopIds: string[];
}

const effectColors: Record<string, string> = {
  NO_SERVICE: "bg-destructive text-destructive-foreground",
  REDUCED_SERVICE: "bg-yellow-500 text-white",
  SIGNIFICANT_DELAYS: "bg-yellow-500 text-white",
  DETOUR: "bg-blue-500 text-white",
  MODIFIED_SERVICE: "bg-blue-500 text-white",
};

const effectLabels: Record<string, string> = {
  NO_SERVICE: "No Service",
  REDUCED_SERVICE: "Reduced Service",
  SIGNIFICANT_DELAYS: "Delays",
  DETOUR: "Detour",
  MODIFIED_SERVICE: "Modified",
  ADDITIONAL_SERVICE: "Extra Service",
  STOP_MOVED: "Stop Moved",
};

export default function AlertsBanner() {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data } = useQuery<{ alerts: ServiceAlert[]; count: number }>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000,
  });

  const alerts = (data?.alerts || []).filter((a) => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 2);

  return (
    <div
      className="border-b border-border bg-card/80 backdrop-blur-sm"
      data-testid="alerts-banner"
    >
      <div className="max-w-full overflow-hidden">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-2 px-4 py-2 border-b border-border/50 last:border-0"
            data-testid={`alert-${alert.id}`}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Effect badge */}
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    effectColors[alert.effect] || "bg-muted text-muted-foreground"
                  }`}
                >
                  {effectLabels[alert.effect] || alert.effect}
                </span>
                {/* Route badges */}
                {alert.routeIds.slice(0, 5).map((rid) => (
                  <Badge
                    key={rid}
                    variant="outline"
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    <Bus className="w-2.5 h-2.5 mr-0.5" />
                    {rid.replace(/^0+/, "")}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-foreground mt-0.5 leading-snug line-clamp-2">
                {alert.headerText || alert.descriptionText}
              </p>
            </div>
            <button
              onClick={() =>
                setDismissed((prev) => new Set([...prev, alert.id]))
              }
              className="shrink-0 p-1 hover:bg-muted rounded"
              aria-label="Dismiss alert"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {alerts.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="alerts-toggle"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> {alerts.length - 2} more
              alert{alerts.length - 2 > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  );
}
