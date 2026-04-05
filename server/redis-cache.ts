import Redis from "ioredis";
import { getCachedVehicles, getCachedTripUpdates, getCachedAlerts, VehiclePosition, TripUpdate, ServiceAlert } from "./gtfs-realtime";

// Redis configuration
const REDIS_URL = process.env.REDIS_URL;
const REDIS_CHANNEL = "cota:vehicle:updates";

// Cache keys
const CACHE_KEYS = {
  VEHICLES: "cota:vehicles",
  TRIP_UPDATES: "cota:trip_updates",
  ALERTS: "cota:alerts",
  TRAFFIC: "cota:traffic",
  WEATHER: "cota:weather",
  LAST_UPDATE: "cota:last_update",
} as const;

// TTL in seconds (refresh before expiry to ensure freshness)
const CACHE_TTL = 30;

// Singleton instances
let redis: Redis | null = null;
let subscriber: Redis | null = null;
let publisher: Redis | null = null;

// Pub/Sub handlers
type UpdateHandler = (data: { vehicles: VehiclePosition[]; tripUpdates: TripUpdate[]; alerts: ServiceAlert[]; timestamp: number }) => void;
const updateHandlers: Set<UpdateHandler> = new Set();

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    console.log("[Redis] REDIS_URL not set, running without Redis cache");
    return;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn("[Redis] Max retries reached, continuing without Redis");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    publisher = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    await redis.connect();
    await subscriber.connect();
    await publisher.connect();

    // Subscribe to vehicle updates channel
    await subscriber.subscribe(REDIS_CHANNEL);

    subscriber.on("message", (_channel, message) => {
      try {
        const data = JSON.parse(message);
        // Notify all handlers
        updateHandlers.forEach((handler) => handler(data));
      } catch (err) {
        console.error("[Redis] Error parsing pub/sub message:", err);
      }
    });

    console.log("[Redis] Connected and subscribed to", REDIS_CHANNEL);
  } catch (err) {
    console.warn("[Redis] Failed to connect to Redis, continuing without cache:", err);
    redis = null;
    subscriber = null;
    publisher = null;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === "ready";
}

/**
 * Cache vehicles in Redis
 */
export async function cacheVehicles(vehicles: VehiclePosition[]): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const pipeline = redis!.pipeline();
    pipeline.set(CACHE_KEYS.VEHICLES, JSON.stringify(vehicles), "EX", CACHE_TTL);
    pipeline.set(CACHE_KEYS.LAST_UPDATE, Date.now().toString(), "EX", CACHE_TTL);
    await pipeline.exec();
  } catch (err) {
    console.error("[Redis] Error caching vehicles:", err);
  }
}

/**
 * Cache trip updates in Redis
 */
export async function cacheTripUpdates(updates: TripUpdate[]): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await redis!.set(CACHE_KEYS.TRIP_UPDATES, JSON.stringify(updates), "EX", CACHE_TTL);
  } catch (err) {
    console.error("[Redis] Error caching trip updates:", err);
  }
}

/**
 * Cache service alerts in Redis
 */
export async function cacheAlerts(alerts: ServiceAlert[]): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await redis!.set(CACHE_KEYS.ALERTS, JSON.stringify(alerts), "EX", CACHE_TTL);
  } catch (err) {
    console.error("[Redis] Error caching alerts:", err);
  }
}

/**
 * Cache traffic data in Redis
 */
export async function cacheTraffic(data: unknown): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await redis!.set(CACHE_KEYS.TRAFFIC, JSON.stringify(data), "EX", CACHE_TTL);
  } catch (err) {
    console.error("[Redis] Error caching traffic:", err);
  }
}

/**
 * Cache weather data in Redis
 */
export async function cacheWeather(data: unknown): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await redis!.set(CACHE_KEYS.WEATHER, JSON.stringify(data), "EX", CACHE_TTL);
  } catch (err) {
    console.error("[Redis] Error caching weather:", err);
  }
}

/**
 * Get cached vehicles from Redis (or local cache as fallback)
 */
export async function getCachedVehiclesFromRedis(): Promise<VehiclePosition[]> {
  if (!isRedisAvailable()) {
    return getCachedVehicles();
  }

  try {
    const cached = await redis!.get(CACHE_KEYS.VEHICLES);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[Redis] Error getting cached vehicles:", err);
  }

  // Fallback to local cache
  return getCachedVehicles();
}

/**
 * Get cached trip updates from Redis
 */
export async function getCachedTripUpdatesFromRedis(): Promise<TripUpdate[]> {
  if (!isRedisAvailable()) {
    return getCachedTripUpdates();
  }

  try {
    const cached = await redis!.get(CACHE_KEYS.TRIP_UPDATES);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[Redis] Error getting cached trip updates:", err);
  }

  return getCachedTripUpdates();
}

/**
 * Get cached alerts from Redis
 */
export async function getCachedAlertsFromRedis(): Promise<ServiceAlert[]> {
  if (!isRedisAvailable()) {
    return getCachedAlerts();
  }

  try {
    const cached = await redis!.get(CACHE_KEYS.ALERTS);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[Redis] Error getting cached alerts:", err);
  }

  return getCachedAlerts();
}

/**
 * Get last update timestamp from Redis
 */
export async function getLastUpdateFromRedis(): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const cached = await redis!.get(CACHE_KEYS.LAST_UPDATE);
    return cached ? parseInt(cached, 10) : 0;
  } catch (err) {
    console.error("[Redis] Error getting last update time:", err);
    return 0;
  }
}

/**
 * Publish vehicle update to all subscribers
 */
export async function publishVehicleUpdate(): Promise<void> {
  if (!isRedisAvailable() || !publisher) return;

  try {
    const data = {
      vehicles: getCachedVehicles(),
      tripUpdates: getCachedTripUpdates(),
      alerts: getCachedAlerts(),
      timestamp: Date.now(),
    };

    await publisher.publish(REDIS_CHANNEL, JSON.stringify(data));
  } catch (err) {
    console.error("[Redis] Error publishing vehicle update:", err);
  }
}

/**
 * Subscribe to vehicle updates (for multi-instance synchronization)
 */
export function subscribeToVehicleUpdates(handler: UpdateHandler): () => void {
  updateHandlers.add(handler);

  // Return unsubscribe function
  return () => {
    updateHandlers.delete(handler);
  };
}

/**
 * Close Redis connections
 */
export async function closeRedis(): Promise<void> {
  try {
    if (redis) await redis.quit();
    if (subscriber) await subscriber.quit();
    if (publisher) await publisher.quit();
    console.log("[Redis] Connections closed");
  } catch (err) {
    console.error("[Redis] Error closing connections:", err);
  }
}

/**
 * Health check for Redis
 */
export async function redisHealthCheck(): Promise<{ ok: boolean; latency?: number; error?: string }> {
  if (!isRedisAvailable()) {
    return { ok: false, error: "Redis not connected" };
  }

  try {
    const start = Date.now();
    await redis!.ping();
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
