import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { downloadAndLoadGtfs } from "./gtfs-loader";
import {
  getCachedVehicles,
  getCachedTripUpdates,
  getCachedAlerts,
  getLastFetchTime,
  startPolling,
} from "./gtfs-realtime";
import { getCachedWeather, startWeatherPolling } from "./weather";
import { getCachedTraffic, startTrafficPolling } from "./traffic";

// Haversine distance in km (used only for vehicle-to-stop distance in ETA calculation)
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function registerRoutes(server: Server, app: Express) {
  // Initialize GTFS data on startup
  initializeGtfs();

  // Start weather and traffic polling
  startWeatherPolling();
  startTrafficPolling();

  // --- Real-time endpoints ---

  // GET /api/vehicles - All real-time vehicle positions
  app.get("/api/vehicles", (_req, res) => {
    const vehicles = getCachedVehicles();
    const lastFetch = getLastFetchTime();
    res.json({
      vehicles,
      lastUpdated: lastFetch,
      count: vehicles.length,
    });
  });

  // GET /api/vehicles/:routeId - Vehicles for a specific route
  app.get("/api/vehicles/:routeId", (req, res) => {
    const vehicles = getCachedVehicles().filter(
      (v) => v.routeId === req.params.routeId
    );
    res.json({ vehicles, count: vehicles.length });
  });

  // GET /api/trip-updates - All trip updates with delays
  app.get("/api/trip-updates", (_req, res) => {
    const updates = getCachedTripUpdates();
    res.json({ updates, count: updates.length });
  });

  // GET /api/trip-updates/:tripId - Trip update for specific trip
  app.get("/api/trip-updates/:tripId", (req, res) => {
    const update = getCachedTripUpdates().find(
      (u) => u.tripId === req.params.tripId
    );
    if (!update) {
      return res.json({ update: null });
    }
    res.json({ update });
  });

  // --- Static GTFS endpoints ---

  // GET /api/routes - All routes
  app.get("/api/routes", async (_req, res) => {
    const routes = await storage.getAllRoutes();
    res.json({ routes });
  });

  // GET /api/routes/:routeId - Single route with shape
  app.get("/api/routes/:routeId", async (req, res) => {
    const route = await storage.getRoute(req.params.routeId);
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    // Get trips for this route to find shape
    const routeTrips = await storage.getTripsByRoute(req.params.routeId);
    const shapeIds = [...new Set(routeTrips.map((t) => t.shapeId).filter(Boolean))] as string[];

    // Get shape geometry (first shape for each direction)
    const shapeGeometry: Record<string, { lat: number; lon: number }[]> = {};
    for (const shapeId of shapeIds.slice(0, 2)) {
      const points = await storage.getShape(shapeId);
      shapeGeometry[shapeId] = points
        .sort((a, b) => a.shapePtSequence - b.shapePtSequence)
        .map((p) => ({ lat: p.shapePtLat, lon: p.shapePtLon }));
    }

    res.json({ route, shapes: shapeGeometry });
  });

  // GET /api/stops - All stops (with optional bounding box filter)
  app.get("/api/stops", async (req, res) => {
    const { minLat, maxLat, minLon, maxLon } = req.query;
    let allStops = await storage.getAllStops();

    if (minLat && maxLat && minLon && maxLon) {
      allStops = allStops.filter(
        (s) =>
          s.stopLat >= Number(minLat) &&
          s.stopLat <= Number(maxLat) &&
          s.stopLon >= Number(minLon) &&
          s.stopLon <= Number(maxLon)
      );
    }

    res.json({ stops: allStops });
  });

  // GET /api/stops/nearby?lat=&lon=&radius= - Find stops near a location using PostGIS ST_DWithin
  app.get("/api/stops/nearby", async (req, res) => {
    const { lat, lon, radius } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon required" });
    }

    const userLat = Number(lat);
    const userLon = Number(lon);
    const searchRadius = Number(radius) || 0.5; // km

    // Use PostGIS ST_DWithin for efficient spatial query
    const nearby = await storage.getStopsNearby(userLat, userLon, searchRadius);
    res.json({ stops: nearby });
  });

  // GET /api/stops/:stopId - Single stop with upcoming arrivals
  app.get("/api/stops/:stopId", async (req, res) => {
    const stop = await storage.getStop(req.params.stopId);
    if (!stop) {
      return res.status(404).json({ error: "Stop not found" });
    }
    res.json({ stop });
  });

  // GET /api/eta?lat=&lon=&stopId= - ETA to user location from nearest vehicles
  app.get("/api/eta", async (req, res) => {
    const { lat, lon, stopId } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon are required" });
    }

    const userLat = Number(lat);
    const userLon = Number(lon);
    const vehicles = getCachedVehicles();
    const tripUpdates = getCachedTripUpdates();

    // If stopId provided, get ETAs for that stop
    if (stopId) {
      const stop = await storage.getStop(String(stopId));
      if (!stop) return res.status(404).json({ error: "Stop not found" });

      // Find vehicles heading to this stop
      const etas = vehicles
        .map((v) => {
          const tripUpdate = tripUpdates.find((tu) => tu.tripId === v.tripId);
          const stopUpdate = tripUpdate?.stopTimeUpdates.find(
            (su) => su.stopId === String(stopId)
          );
          const distToStop = haversine(
            v.latitude,
            v.longitude,
            stop.stopLat,
            stop.stopLon
          );
          const distUserToStop = haversine(
            userLat,
            userLon,
            stop.stopLat,
            stop.stopLon
          );

          // Rough ETA: distance / average bus speed (25 km/h in city)
          const etaMinutes = Math.round((distToStop / 25) * 60);
          const delay = stopUpdate?.arrivalDelay || 0;

          return {
            vehicleId: v.vehicleId,
            routeId: v.routeId,
            tripId: v.tripId,
            label: v.label,
            distanceToStop: Math.round(distToStop * 1000), // meters
            etaMinutes: etaMinutes + Math.round(delay / 60),
            delay,
            bearing: v.bearing,
            vehicleLat: v.latitude,
            vehicleLon: v.longitude,
            distUserToStop: Math.round(distUserToStop * 1000),
          };
        })
        .filter((e) => e.distanceToStop < 15000 && e.etaMinutes < 60)
        .sort((a, b) => a.etaMinutes - b.etaMinutes)
        .slice(0, 10);

      return res.json({ etas, stop });
    }

    // Otherwise find nearest stops using PostGIS, then vehicles per stop
    const nearbyStopsResult = await storage.getStopsNearby(userLat, userLon, 0.8);
    const nearbyStops = nearbyStopsResult.slice(0, 5);

    const results = await Promise.all(nearbyStops.slice(0, 5).map(async (stop) => {
      const routeMap = new Map<string, { routeShortName: string; routeColor: string }>();
      const uniqueRouteIds = [...new Set(vehicles.map((v) => v.routeId))];
      await Promise.all(uniqueRouteIds.map(async (routeId) => {
        const r = await storage.getRoute(routeId);
        if (r) routeMap.set(routeId, { routeShortName: r.routeShortName, routeColor: r.routeColor || "1976D2" });
      }));

      const nearbyVehicles = vehicles
        .map((v) => {
          const dist = haversine(v.latitude, v.longitude, stop.stopLat, stop.stopLon);
          const etaMinutes = Math.round((dist / 25) * 60);
          const route = routeMap.get(v.routeId);
          return {
            vehicleId: v.vehicleId,
            routeId: v.routeId,
            routeName: route?.routeShortName || v.routeId,
            routeColor: route?.routeColor || "1976D2",
            etaMinutes,
            distanceMeters: Math.round(dist * 1000),
            bearing: v.bearing,
          };
        })
        .filter((v) => v.distanceMeters < 10000 && v.etaMinutes < 45)
        .sort((a, b) => a.etaMinutes - b.etaMinutes)
        .slice(0, 5);

      return {
        stop: {
          stopId: stop.stopId,
          stopName: stop.stopName,
          lat: stop.stopLat,
          lon: stop.stopLon,
          distanceMeters: Math.round(stop.distance),
          walkMinutes: Math.round((stop.distance / 1000 / 5) * 60),
        },
        vehicles: nearbyVehicles,
      };
    }));

    res.json({ results });
  });

  // --- Weather endpoint ---
  app.get("/api/weather", (_req, res) => {
    res.json(getCachedWeather());
  });

  // --- Service Alerts endpoint ---
  app.get("/api/alerts", (_req, res) => {
    const alerts = getCachedAlerts();
    res.json({ alerts, count: alerts.length });
  });

  // --- Traffic Incidents & Cameras endpoint ---
  app.get("/api/traffic", (_req, res) => {
    res.json(getCachedTraffic());
  });

  // GET /api/status - System status
  app.get("/api/status", async (_req, res) => {
    const hasData = await storage.hasData();
    const vehicleCount = getCachedVehicles().length;
    const lastUpdate = getLastFetchTime();
    const weather = getCachedWeather();
    const traffic = getCachedTraffic();
    res.json({
      gtfsLoaded: hasData,
      vehicleCount,
      alertCount: getCachedAlerts().length,
      weatherEnabled: !!weather.current,
      trafficEnabled: traffic.enabled,
      trafficIncidentCount: traffic.incidents.length,
      lastRealtimeUpdate: lastUpdate,
      uptime: process.uptime(),
    });
  });
}

async function initializeGtfs() {
  try {
    if (!(await storage.hasData())) {
      console.log("[Init] No GTFS data found, downloading...");
      await downloadAndLoadGtfs();
    } else {
      console.log("[Init] GTFS data already loaded");
    }
    // Start real-time polling
    startPolling(10000);
  } catch (err) {
    console.error("[Init] Failed to initialize GTFS:", err);
    // Start polling anyway — the RT data doesn't depend on static data
    startPolling(10000);
  }
}
