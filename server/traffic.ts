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

export interface TrafficData {
  incidents: TrafficIncident[];
  lastUpdated: number;
  enabled: boolean;
}

let cachedTraffic: TrafficData = {
  incidents: [],
  lastUpdated: 0,
  enabled: false,
};

function getApiKey(): string | null {
  return process.env.OHGO_API_KEY || null;
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

export function startTrafficPolling(intervalMs = 120000): void {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log("[Traffic] OHGO_API_KEY not set — traffic integration disabled. Register at https://publicapi.ohgo.com");
    cachedTraffic.enabled = false;
    return;
  }
  console.log(`[Traffic] Starting OHGO polling every ${intervalMs / 60000} min`);
  cachedTraffic.enabled = true;
  fetchTrafficIncidents();
  trafficInterval = setInterval(fetchTrafficIncidents, intervalMs);
}

export function stopTrafficPolling(): void {
  if (trafficInterval) {
    clearInterval(trafficInterval);
    trafficInterval = null;
  }
}
