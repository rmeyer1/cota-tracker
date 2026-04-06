import { useTheme } from "@/hooks/use-theme";
import WeatherBar from "@/components/WeatherBar";
import { Button } from "@/components/ui/button";
import { Video, Sun, Moon } from "lucide-react";

interface TrackerHeaderProps {
  vehicleCount: number;
  lastUpdateText: string;
  showCameras: boolean;
  onToggleCameras: () => void;
}

export function TrackerHeader({
  vehicleCount,
  lastUpdateText,
  showCameras,
  onToggleCameras,
}: TrackerHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-4 bg-card border-b border-border z-10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Left: Logo + branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            aria-label="COTA Tracker"
          >
            <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
            <path
              d="M8 22V14a8 8 0 0116 0v8"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="12" cy="22" r="2.5" fill="white" />
            <circle cx="20" cy="22" r="2.5" fill="white" />
            <rect
              x="10"
              y="11"
              width="12"
              height="5"
              rx="1.5"
              fill="white"
              opacity="0.4"
            />
          </svg>
          <div>
            <h1 className="text-sm font-bold leading-none">COTA Tracker</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Columbus Transit · Live
            </p>
          </div>
        </div>
      </div>

      {/* Right: Weather, live indicator, camera toggle, theme toggle */}
      <div className="flex items-center gap-2">
        <WeatherBar />

        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 mr-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
          <span className="text-xs text-muted-foreground">
            {vehicleCount} buses · {lastUpdateText}
          </span>
        </div>

        {/* Camera toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${showCameras ? "text-blue-500 bg-blue-50 dark:bg-blue-950" : ""}`}
          onClick={onToggleCameras}
          data-testid="cameras-toggle"
          title={showCameras ? "Hide traffic cameras" : "Show traffic cameras"}
        >
          <Video className="w-4 h-4" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          data-testid="theme-toggle"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
