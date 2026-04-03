import { storage } from "./storage";
import { getCachedVehicles, type VehiclePosition } from "./gtfs-realtime";

export interface ShapePoint {
  lat: number;
  lon: number;
  sequence: number;
  cumulativeDistance: number;
}

export interface RouteShape {
  shapeId: string;
  points: ShapePoint[];
  totalDistance: number;
}

export interface InterpolatedVehicle {
  vehicleId: string;
  tripId: string;
  routeId: string;
  // Current interpolated position
  currentPosition: {
    lat: number;
    lon: number;
    bearing: number;
  };
  // Previous known position
  previousPosition: {
    lat: number;
    lon: number;
    bearing: number;
    timestamp: number;
  };
  // Next known position (if available)
  nextPosition: {
    lat: number;
    lon: number;
    bearing: number;
    timestamp: number;
  } | null;
  // Progress between previous and next (0-1)
  progress: number;
  // Speed in km/h
  speed: number;
  // Whether this is using route-based interpolation
  isInterpolated: boolean;
  // Shape ID being used
  shapeId: string | null;
}

// Cache for route shapes to avoid repeated DB queries
const shapeCache: Map<string, RouteShape> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps: Map<string, number> = new Map();

function getCachedShape(shapeId: string): RouteShape | null {
  const cached = shapeCache.get(shapeId);
  const timestamp = cacheTimestamps.get(shapeId);
  
  if (cached && timestamp && Date.now() - timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
}

function cacheShape(shapeId: string, shape: RouteShape): void {
  shapeCache.set(shapeId, shape);
  cacheTimestamps.set(shapeId, Date.now());
}

// Load and preprocess route shape from database
export function getRouteShape(shapeId: string): RouteShape | null {
  // Check cache first
  const cached = getCachedShape(shapeId);
  if (cached) return cached;

  // Load from database
  const dbPoints = storage.getShape(shapeId);
  if (!dbPoints || dbPoints.length === 0) return null;

  // Sort by sequence
  const sorted = [...dbPoints].sort((a, b) => a.shapePtSequence - b.shapePtSequence);

  // Calculate cumulative distances
  const points: ShapePoint[] = sorted.map((p, i) => ({
    lat: p.shapePtLat,
    lon: p.shapePtLon,
    sequence: p.shapePtSequence,
    cumulativeDistance: i === 0 ? 0 : 0, // Will calculate below
  }));

  // Calculate cumulative distance from start
  let totalDistance = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const dist = haversineDistance(
        points[i - 1].lat, points[i - 1].lon,
        points[i].lat, points[i].lon
      );
      totalDistance += dist;
    }
    points[i].cumulativeDistance = totalDistance;
  }

  const routeShape: RouteShape = {
    shapeId,
    points,
    totalDistance,
  };

  // Cache it
  cacheShape(shapeId, routeShape);

  return routeShape;
}

// Find the nearest point on a shape to a given position
function findNearestPointOnShape(
  lat: number,
  lon: number,
  shape: RouteShape
): { point: ShapePoint; distance: number; index: number } {
  let nearestDist = Infinity;
  let nearestPoint = shape.points[0];
  let nearestIndex = 0;

  for (let i = 0; i < shape.points.length; i++) {
    const p = shape.points[i];
    const dist = haversineDistance(lat, lon, p.lat, p.lon);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPoint = p;
      nearestIndex = i;
    }
  }

  return { point: nearestPoint, distance: nearestDist, index: nearestIndex };
}

// Interpolate position along shape at a given distance
function interpolateAlongShape(
  shape: RouteShape,
  distance: number
): { lat: number; lon: number; bearing: number } | null {
  if (shape.points.length < 2) return null;
  
  // Clamp distance to valid range
  const dist = Math.max(0, Math.min(distance, shape.totalDistance));

  // Find the two points bounding this distance
  let leftIndex = 0;
  for (let i = 0; i < shape.points.length - 1; i++) {
    if (shape.points[i + 1].cumulativeDistance >= dist) {
      leftIndex = i;
      break;
    }
  }

  const left = shape.points[leftIndex];
  const right = shape.points[leftIndex + 1] || left;

  // Linear interpolation factor
  const segmentDist = right.cumulativeDistance - left.cumulativeDistance;
  const t = segmentDist > 0 ? (dist - left.cumulativeDistance) / segmentDist : 0;

  // Interpolate lat/lon
  const lat = left.lat + (right.lat - left.lat) * t;
  const lon = left.lon + (right.lon - left.lon) * t;

  // Calculate bearing
  const bearing = calculateBearing(left.lat, left.lon, right.lat, right.lon);

  return { lat, lon, bearing };
}

// Smooth bearing interpolation (handles 0/360 wrap)
function interpolateBearing(
  from: number,
  to: number,
  t: number
): number {
  // Calculate shortest angular path
  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  
  const result = from + diff * t;
  return (result + 360) % 360;
}

// Haversine distance in kilometers
function haversineDistance(
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

// Calculate bearing between two points in degrees
function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

// Get vehicle trip to find shape
function getVehicleShape(vehicle: VehiclePosition): { shapeId: string; shape: RouteShape } | null {
  if (!vehicle.tripId) return null;
  
  const trip = storage.getTrip(vehicle.tripId);
  if (!trip?.shapeId) return null;

  const shape = getRouteShape(trip.shapeId);
  if (!shape) return null;

  return { shapeId: trip.shapeId, shape };
}

// Main function: get interpolated vehicles for a route
export function getInterpolatedVehicles(
  routeId: string,
  timestamp: number = Date.now()
): InterpolatedVehicle[] {
  const vehicles = getCachedVehicles().filter(v => v.routeId === routeId);
  
  // Pre-load all shapes needed for this route's vehicles
  const vehiclesNeedingShapes = vehicles.filter(v => v.tripId);
  for (const v of vehiclesNeedingShapes) {
    if (v.tripId) {
      const trip = storage.getTrip(v.tripId);
      if (trip?.shapeId && !shapeCache.has(trip.shapeId)) {
        getRouteShape(trip.shapeId);
      }
    }
  }

  // Get all vehicles and compute interpolation data
  return vehicles.map(vehicle => {
    const shapeData = getVehicleShape(vehicle);
    
    if (!shapeData) {
      // Fall back to linear interpolation (current behavior)
      return {
        vehicleId: vehicle.vehicleId,
        tripId: vehicle.tripId,
        routeId: vehicle.routeId,
        currentPosition: {
          lat: vehicle.latitude,
          lon: vehicle.longitude,
          bearing: vehicle.bearing,
        },
        previousPosition: {
          lat: vehicle.latitude,
          lon: vehicle.longitude,
          bearing: vehicle.bearing,
          timestamp: vehicle.timestamp * 1000,
        },
        nextPosition: null,
        progress: 1,
        speed: vehicle.speed * 3.6, // m/s to km/h
        isInterpolated: false,
        shapeId: null,
      };
    }

    const { shape } = shapeData;

    // Map current position to shape
    const mapped = findNearestPointOnShape(vehicle.latitude, vehicle.longitude, shape);
    const distanceAlongShape = mapped.point.cumulativeDistance;

    // Calculate progress based on time since last update
    const timeSinceUpdate = timestamp - (vehicle.timestamp * 1000);
    const maxUpdateInterval = 30000; // 30 seconds max to interpolate
    const progress = Math.min(timeSinceUpdate / maxUpdateInterval, 1);

    // Estimate next position based on speed and direction
    const speedKmh = vehicle.speed * 3.6; // m/s to km/h
    const estimatedDistanceTraveled = (speedKmh / 3600) * timeSinceUpdate; // km
    const nextDistance = distanceAlongShape + estimatedDistanceTraveled;
    
    // Get current interpolated position
    const currentPos = interpolateAlongShape(shape, distanceAlongShape) || {
      lat: vehicle.latitude,
      lon: vehicle.longitude,
      bearing: vehicle.bearing,
    };

    // Get next estimated position (for smooth animation continuation)
    const nextPos = interpolateAlongShape(shape, nextDistance);

    return {
      vehicleId: vehicle.vehicleId,
      tripId: vehicle.tripId,
      routeId: vehicle.routeId,
      currentPosition: currentPos,
      previousPosition: {
        lat: vehicle.latitude,
        lon: vehicle.longitude,
        bearing: vehicle.bearing,
        timestamp: vehicle.timestamp * 1000,
      },
      nextPosition: nextPos ? {
        lat: nextPos.lat,
        lon: nextPos.lon,
        bearing: nextPos.bearing,
        timestamp: timestamp,
      } : null,
      progress,
      speed: speedKmh,
      isInterpolated: true,
      shapeId: shapeData.shapeId,
    };
  });
}

// Get shapes for a specific route (returns GeoJSON-style coordinates)
export function getRouteShapesForMap(routeId: string): Record<string, { lat: number; lon: number }[]> {
  const routeTrips = storage.getTripsByRoute(routeId);
  const shapeIds = [...new Set(routeTrips.map(t => t.shapeId).filter(Boolean))] as string[];
  
  const shapes: Record<string, { lat: number; lon: number }[]> = {};
  
  for (const shapeId of shapeIds) {
    const shape = getRouteShape(shapeId);
    if (shape) {
      shapes[shapeId] = shape.points.map(p => ({ lat: p.lat, lon: p.lon }));
    }
  }
  
  return shapes;
}
