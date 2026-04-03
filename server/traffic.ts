// OHGO Public API — Ohio DOT real-time traffic
// Requires API key from https://publicapi.ohgo.com
// Set OHGO_API_KEY env var to enable

const OHGO_BASE = "https://publicapi.ohgo.com/api/v1";

export interface TrafficIncident {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  direction: string;
  roadName: string;
  severity: string;
  type: string;
  startDate: string;
  isRoadClosed: boolean;
}

export interface TrafficCamera {
  id: string;
  latitude: number;
  longitude: number;
  location: string;
  description: string;
  cameraViews: {
    direction: string;
    smallUrl: string;
    largeUrl: string;
    mainRoute: string;
  }[];
}

export interface TrafficData {
  incidents: TrafficIncident[];
  cameras: TrafficCamera[];
  lastUpdated: number;
  enabled: boolean;
}

let cachedTraffic: TrafficData = {
  incidents: [],
  cameras: [],
  lastUpdated: 0,
  enabled: false,
};

function getApiKey(): string | null {
  return process.env.OHGO_API_KEY || null;
}

export async function fetchTrafficCameras(): Promise<TrafficCamera[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return cachedTraffic.cameras;
  }

  try {
    const url = `${OHGO_BASE}/cameras?region=columbus`;
    const res = await fetch(url, {
      headers: {
        Authorization: `APIKEY ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Traffic] OHGO cameras failed: ${res.status}`);
      return cachedTraffic.cameras;
    }

    const data = await res.json();
    const results = (data.results || [])
      .filter((r: any) => r.latitude && r.longitude)
      .map((r: any) => ({
        id: String(r.id || ""),
        latitude: r.latitude,
        longitude: r.longitude,
        location: r.location || "",
        description: r.description || "",
        cameraViews: (r.cameraViews || []).map((cv: any) => ({
          direction: cv.direction || "",
          smallUrl: cv.smallUrl || "",
          largeUrl: cv.largeUrl || "",
          mainRoute: cv.mainRoute || "",
        })),
      }));

    cachedTraffic = {
      ...cachedTraffic,
      cameras: results,
    };

    console.log(`[Traffic] Fetched ${results.length} cameras`);
    return results;
  } catch (err) {
    console.error("[Traffic] Error fetching cameras:", err);
    return cachedTraffic.cameras;
  }
}

export async function fetchTrafficIncidents(): Promise<TrafficIncident[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return cachedTraffic.incidents;
  }

  try {
    // Columbus area bounding box (roughly)
    const url = `${OHGO_BASE}/incidents?region=columbus`;
    const res = await fetch(url, {
      headers: {
        Authorization: `APIKEY ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Traffic] OHGO incidents failed: ${res.status}`);
      return cachedTraffic.incidents;
    }

    const data = await res.json();
    const results = (data.results || [])
      .filter((r: any) => r.latitude && r.longitude)
      .map((r: any) => ({
        id: String(r.id || ""),
        latitude: r.latitude,
        longitude: r.longitude,
        description: r.description || "",
        direction: r.direction || "",
        roadName: r.roadName || "",
        severity: r.severity || "UNKNOWN",
        type: r.type || "INCIDENT",
        startDate: r.startDate || "",
        isRoadClosed: r.isRoadClosed || false,
      }));

    cachedTraffic = {
      ...cachedTraffic,
      incidents: results,
      lastUpdated: Date.now(),
      enabled: true,
    };

    console.log(`[Traffic] Fetched ${results.length} incidents`);
    return results;
  } catch (err) {
    console.error("[Traffic] Error fetching incidents:", err);
    return cachedTraffic.incidents;
  }
}

export function getCachedTraffic(): TrafficData {
  return {
    ...cachedTraffic,
    enabled: !!getApiKey(),
  };
}

// Poll every 2 minutes
let trafficInterval: NodeJS.Timeout | null = null;

export function startTrafficPolling(intervalMs = 10000): void {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log("[Traffic] OHGO_API_KEY not set — traffic integration disabled. Register at https://publicapi.ohgo.com");
    cachedTraffic.enabled = false;
    return;
  }
  console.log(`[Traffic] Starting OHGO polling every ${intervalMs / 1000} sec`);
  cachedTraffic.enabled = true;
  fetchTrafficIncidents();
  fetchTrafficCameras();
  trafficInterval = setInterval(() => {
    fetchTrafficIncidents();
    fetchTrafficCameras();
  }, intervalMs);
}

export function stopTrafficPolling(): void {
  if (trafficInterval) {
    clearInterval(trafficInterval);
    trafficInterval = null;
  }
}
