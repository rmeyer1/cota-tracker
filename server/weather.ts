// National Weather Service API — free, no key required
// Docs: https://www.weather.gov/documentation/services-web-api

const NWS_BASE = "https://api.weather.gov";
const NWS_HEADERS = {
  "User-Agent": "COTATracker/1.0 (cota-tracker-app)",
  Accept: "application/geo+json",
};

// Columbus, OH grid point (pre-resolved to avoid extra API call)
const GRID_OFFICE = "ILN";
const GRID_X = 85;
const GRID_Y = 81;
const COLUMBUS_LAT = 39.9612;
const COLUMBUS_LON = -82.9988;

export interface WeatherCurrent {
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  icon: string;
  windSpeed: string;
  windDirection: string;
  precipChance: number;
  isDaytime: boolean;
  startTime: string;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  instruction: string | null;
  expires: string;
  areaDesc: string;
}

export interface WeatherData {
  current: WeatherCurrent | null;
  hourly: WeatherCurrent[];
  alerts: WeatherAlert[];
  lastUpdated: number;
}

let cachedWeather: WeatherData = {
  current: null,
  hourly: [],
  alerts: [],
  lastUpdated: 0,
};

async function fetchHourlyForecast(): Promise<WeatherCurrent[]> {
  try {
    const url = `${NWS_BASE}/gridpoints/${GRID_OFFICE}/${GRID_X},${GRID_Y}/forecast/hourly`;
    const res = await fetch(url, { headers: NWS_HEADERS });
    if (!res.ok) {
      console.error(`[Weather] Hourly forecast failed: ${res.status}`);
      return cachedWeather.hourly;
    }
    const data = await res.json();
    const periods = data.properties?.periods || [];
    return periods.slice(0, 12).map((p: any) => ({
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      shortForecast: p.shortForecast,
      icon: p.icon,
      windSpeed: p.windSpeed,
      windDirection: p.windDirection,
      precipChance: p.probabilityOfPrecipitation?.value ?? 0,
      isDaytime: p.isDaytime,
      startTime: p.startTime,
    }));
  } catch (err) {
    console.error("[Weather] Error fetching hourly forecast:", err);
    return cachedWeather.hourly;
  }
}

async function fetchAlerts(): Promise<WeatherAlert[]> {
  try {
    const url = `${NWS_BASE}/alerts/active?point=${COLUMBUS_LAT},${COLUMBUS_LON}`;
    const res = await fetch(url, { headers: NWS_HEADERS });
    if (!res.ok) {
      console.error(`[Weather] Alerts fetch failed: ${res.status}`);
      return cachedWeather.alerts;
    }
    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      id: f.properties.id,
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline || "",
      description: f.properties.description || "",
      instruction: f.properties.instruction || null,
      expires: f.properties.expires,
      areaDesc: f.properties.areaDesc || "",
    }));
  } catch (err) {
    console.error("[Weather] Error fetching alerts:", err);
    return cachedWeather.alerts;
  }
}

export async function refreshWeather(): Promise<void> {
  const [hourly, alerts] = await Promise.all([
    fetchHourlyForecast(),
    fetchAlerts(),
  ]);
  cachedWeather = {
    current: hourly.length > 0 ? hourly[0] : null,
    hourly,
    alerts,
    lastUpdated: Date.now(),
  };
  console.log(
    `[Weather] Updated: ${cachedWeather.current?.temperature}°${cachedWeather.current?.temperatureUnit} ${cachedWeather.current?.shortForecast}, ${alerts.length} alerts`
  );
}

export function getCachedWeather(): WeatherData {
  return cachedWeather;
}

// Poll every 10 minutes (NWS updates hourly, no need to hammer)
let weatherInterval: NodeJS.Timeout | null = null;

export function startWeatherPolling(intervalMs = 600000): void {
  console.log(`[Weather] Starting polling every ${intervalMs / 60000} min`);
  refreshWeather();
  weatherInterval = setInterval(refreshWeather, intervalMs);
}

export function stopWeatherPolling(): void {
  if (weatherInterval) {
    clearInterval(weatherInterval);
    weatherInterval = null;
  }
}
