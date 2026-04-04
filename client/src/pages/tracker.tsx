import { useState } from "react";
import AlertsBanner from "@/components/AlertsBanner";
import { useUserLocation } from "@/hooks/use-location";
import { useTrackerData } from "@/hooks/useTrackerData";
import { useSelectedRouteShape } from "@/hooks/useSelectedRouteShape";
import { useVehiclePresentation } from "@/hooks/useVehiclePresentation";
import { TrackerHeader } from "@/components/tracker/TrackerHeader";
import { TrackerMapSection } from "@/components/tracker/TrackerMapSection";
import { TrackerSidebar } from "@/components/tracker/TrackerSidebar";
import { useTheme } from "@/hooks/use-theme";

export default function TrackerPage() {
  const { location: userLocation } = useUserLocation();
  const { theme } = useTheme();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [mapControls, setMapControls] = useState<any>(null);

  // Data fetching
  const {
    routes,
    vehicles,
    traffic,
    vehiclesLoading,
    vehiclesDataUpdatedAt,
  } = useTrackerData();

  // Route shapes for selected route
  const routeShapes = useSelectedRouteShape(selectedRouteId, routes);

  // Derived presentation state
  const { vehicleCounts, routeColorMap, lastUpdateText } = useVehiclePresentation(
    vehicles,
    routes,
    vehiclesDataUpdatedAt
  );

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      data-testid="tracker-page"
    >
      {/* Service Alerts Banner */}
      <AlertsBanner />

      {/* Top bar */}
      <TrackerHeader
        vehicleCount={vehicles.length}
        lastUpdateText={lastUpdateText}
        showCameras={showCameras}
        onToggleCameras={() => setShowCameras((v) => !v)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <TrackerMapSection
          vehicles={vehicles}
          routeShapes={routeShapes}
          userLocation={userLocation}
          selectedRouteId={selectedRouteId}
          theme={theme}
          routeColorMap={routeColorMap}
          trafficIncidents={traffic.incidents}
          trafficCameras={traffic.cameras}
          showCameras={showCameras}
          isLoading={vehiclesLoading}
          vehicleCount={vehicles.length}
          onMapReady={setMapControls}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Sidebar */}
        <TrackerSidebar
          routes={routes}
          selectedRouteId={selectedRouteId}
          vehicleCounts={vehicleCounts}
          userLocation={userLocation}
          onSelectRoute={setSelectedRouteId}
          panelOpen={panelOpen}
        />
      </div>
    </div>
  );
}
