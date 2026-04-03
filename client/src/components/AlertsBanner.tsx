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
    queryKey: ["api/alerts"],
    refetchInterval: 30000,
  });

  const alerts = (data?.alerts || []).filter((a) => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  return (
    <div
      className="border-b border-border bg-card/80 backdrop-blur-sm"
      data-testid="alerts-banner"
    >
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
        data-testid="alerts-toggle"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-semibold">
            {alerts.length} active alert{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Alert list — only visible when expanded */}
      {expanded && (
        <div className="max-w-full">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2 px-4 py-2 border-t border-border/50"
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
                  {/* Route badges — use index in key to handle duplicate routeIds */}
                  {alert.routeIds.slice(0, 5).map((rid, i) => (
                    <Badge
                      key={`${rid}-${i}`}
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      <Bus className="w-2.5 h-2.5 mr-0.5" />
                      {rid.replace(/^0+/, "")}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-foreground mt-0.5 leading-snug">
                  {alert.headerText || alert.descriptionText}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissed((prev) => new Set([...prev, alert.id]));
                }}
                className="shrink-0 p-1 hover:bg-muted rounded"
                aria-label="Dismiss alert"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
