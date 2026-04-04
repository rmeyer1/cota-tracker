import { RefreshCw } from "lucide-react";

interface TrackerLoadingStateProps {
  vehicleCount: number;
}

export function TrackerLoadingState({ vehicleCount }: TrackerLoadingStateProps) {
  return (
    <div className="flex items-center justify-center h-full bg-muted/20">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading COTA data...</p>
        <p className="text-xs text-muted-foreground mt-1">
          {vehicleCount > 0
            ? "Updating vehicle positions..."
            : "Downloading routes and real-time positions"}
        </p>
      </div>
    </div>
  );
}
