import type { MapControls } from "@/components/BusMap";
import { Plus, Minus, Crosshair } from "lucide-react";

interface MapFloatingControlsProps {
  mapControls: MapControls;
}

export function MapFloatingControls({ mapControls }: MapFloatingControlsProps) {
  return (
    <div
      className="absolute right-3 top-3 z-[1000] flex flex-col gap-2"
      data-testid="map-controls"
    >
      {/* Zoom in */}
      <button
        onClick={() => mapControls.zoomIn()}
        className="w-11 h-11 rounded-xl bg-card border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-muted"
        data-testid="zoom-in-btn"
        aria-label="Zoom in"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Zoom out */}
      <button
        onClick={() => mapControls.zoomOut()}
        className="w-11 h-11 rounded-xl bg-card border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-muted"
        data-testid="zoom-out-btn"
        aria-label="Zoom out"
      >
        <Minus className="w-5 h-5" />
      </button>

      {/* Re-center on user */}
      <button
        onClick={() => mapControls.recenter()}
        className="w-11 h-11 rounded-xl bg-card border border-border shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-muted"
        data-testid="recenter-btn"
        aria-label="Center on my location"
      >
        <Crosshair className="w-5 h-5 text-primary" />
      </button>
    </div>
  );
}
