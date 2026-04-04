import { useState } from "react";
import type { MapControls, TrafficIncident, TrafficCamera, RouteShape } from "@/components/BusMap";
import BusMap from "@/components/BusMap";
import { MapFloatingControls } from "./MapFloatingControls";
import { MobilePanelToggle } from "./MobilePanelToggle";
import { TrackerLoadingState } from "./TrackerLoadingState";

export interface VehicleForMap {
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
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

interface Props {
  vehicles: VehicleForMap[];
  routeShapes: RouteShape[];
  userLocation: UserLocation | null;
  selectedRouteId: string | null;
  theme: "light" | "dark";
  routeColorMap: Map<string, string>;
  trafficIncidents: TrafficIncident[];
  trafficCameras: TrafficCamera[];
  showCameras: boolean;
  isLoading: boolean;
  vehicleCount: number;
  onMapReady: (controls: MapControls) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export function TrackerMapSection({
  vehicles,
  routeShapes,
  userLocation,
  selectedRouteId,
  theme,
  routeColorMap,
  trafficIncidents,
  trafficCameras,
  showCameras,
  isLoading,
  vehicleCount,
  onMapReady,
  panelOpen,
  onTogglePanel,
}: Props) {
  const [mapControls, setMapControls] = useState<MapControls | null>(null);

  return (
    <div className="flex-1 relative">
      {/* Loading state (only show on initial load) */}
      {isLoading && vehicleCount === 0 ? (
        <TrackerLoadingState vehicleCount={vehicleCount} />
      ) : (
        <BusMap
          vehicles={vehicles}
          routeShapes={routeShapes}
          userLocation={userLocation}
          selectedRouteId={selectedRouteId}
          theme={theme}
          routeColorMap={routeColorMap}
          onMapReady={(controls) => {
            setMapControls(controls);
            onMapReady(controls);
          }}
          trafficIncidents={trafficIncidents}
          trafficCameras={trafficCameras}
          showCameras={showCameras}
        />
      )}

      {/* Floating map controls — only show when map is ready */}
      {mapControls && <MapFloatingControls mapControls={mapControls} />}

      {/* Mobile bottom sheet toggle */}
      <MobilePanelToggle panelOpen={panelOpen} onToggle={onTogglePanel} />
    </div>
  );
}
