import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Sun,
  CloudSun,
  CloudFog,
  Wind,
  Droplets,
} from "lucide-react";

interface WeatherCurrent {
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  precipChance: number;
  isDaytime: boolean;
}

interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
}

interface WeatherData {
  current: WeatherCurrent | null;
  alerts: WeatherAlert[];
  lastUpdated: number;
}

function getWeatherIcon(forecast: string, isDaytime: boolean) {
  const f = forecast.toLowerCase();
  if (f.includes("thunder") || f.includes("lightning"))
    return <CloudLightning className="w-4 h-4" />;
  if (f.includes("snow") || f.includes("sleet") || f.includes("ice"))
    return <CloudSnow className="w-4 h-4" />;
  if (f.includes("rain") || f.includes("shower") || f.includes("drizzle"))
    return <CloudRain className="w-4 h-4" />;
  if (f.includes("fog") || f.includes("mist") || f.includes("haze"))
    return <CloudFog className="w-4 h-4" />;
  if (f.includes("partly") || f.includes("mostly cloudy"))
    return <CloudSun className="w-4 h-4" />;
  if (f.includes("cloudy") || f.includes("overcast"))
    return <Cloud className="w-4 h-4" />;
  if (f.includes("sunny") || f.includes("clear"))
    return isDaytime ? <Sun className="w-4 h-4" /> : <Cloud className="w-4 h-4" />;
  return <Cloud className="w-4 h-4" />;
}

export default function WeatherBar() {
  const { data } = useQuery<WeatherData>({
    queryKey: ["/api/weather"],
    refetchInterval: 300000, // 5 minutes
  });

  if (!data?.current) return null;

  const { current, alerts } = data;
  const hasAlerts = alerts.length > 0;
  const severeAlert = alerts.find(
    (a) => a.severity === "Severe" || a.severity === "Extreme"
  );

  return (
    <div className="flex items-center gap-3" data-testid="weather-bar">
      {/* Current conditions */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {getWeatherIcon(current.shortForecast, current.isDaytime)}
        <span className="font-semibold text-foreground">
          {current.temperature}°{current.temperatureUnit}
        </span>
        <span className="hidden sm:inline">{current.shortForecast}</span>
      </div>

      {/* Precipitation warning */}
      {current.precipChance > 20 && (
        <div className="flex items-center gap-1 text-xs text-blue-500">
          <Droplets className="w-3 h-3" />
          <span>{current.precipChance}%</span>
        </div>
      )}

      {/* Severe weather alert badge */}
      {severeAlert && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-semibold animate-pulse"
          title={severeAlert.headline}
          data-testid="weather-alert-badge"
        >
          <CloudLightning className="w-3 h-3" />
          <span className="hidden sm:inline truncate max-w-[120px]">
            {severeAlert.event}
          </span>
        </div>
      )}

      {/* Non-severe alert count */}
      {hasAlerts && !severeAlert && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-semibold"
          title={alerts.map((a) => a.headline).join("\n")}
        >
          <Wind className="w-3 h-3" />
          <span>{alerts.length} alert{alerts.length > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
