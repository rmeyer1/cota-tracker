import { useState, useEffect, useCallback } from "react";

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface UseLocationResult {
  location: UserLocation | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
}

// Default: Columbus, OH downtown
const COLUMBUS_DEFAULT = { latitude: 39.9612, longitude: -82.9988, accuracy: 0 };

export function useUserLocation(): UseLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLocation(COLUMBUS_DEFAULT);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        setError(err.message);
        setLocation(COLUMBUS_DEFAULT);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return { location, error, isLoading, refresh: getLocation };
}
