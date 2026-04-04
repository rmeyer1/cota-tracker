import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import {
  routes, stops, trips, stopTimes, shapes, calendar,
  type Route, type Stop, type Trip, type StopTime, type Shape, type Calendar,
  type InsertRoute, type InsertStop, type InsertTrip, type InsertStopTime, type InsertShape, type InsertCalendar,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// Supabase Postgres connection — password is URL-encoded in env
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Use postgres-js driver (drizzle-orm/postgres-js)
// Supabase requires SSL — append ?sslmode=require
const rawConnectionString = connectionString.includes("?")
  ? `${connectionString}&sslmode=require`
  : `${connectionString}?sslmode=require`;

const client = postgres(rawConnectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client);

export interface IStorage {
  // Routes
  getAllRoutes(): Promise<Route[]>;
  getRoute(routeId: string): Promise<Route | undefined>;

  // Stops
  getAllStops(): Promise<Stop[]>;
  getStop(stopId: string): Promise<Stop | undefined>;
  getStopsByIds(stopIds: string[]): Promise<Stop[]>;
  getStopsNearby(lat: number, lon: number, radiusKm: number): Promise<(Stop & { distance: number })[]>;

  // Trips
  getTrip(tripId: string): Promise<Trip | undefined>;
  getTripsByRoute(routeId: string): Promise<Trip[]>;

  // Stop Times
  getStopTimesForTrip(tripId: string): Promise<StopTime[]>;
  getStopTimesForStop(stopId: string): Promise<StopTime[]>;

  // Shapes
  getShape(shapeId: string): Promise<Shape[]>;

  // Calendar
  getCalendar(serviceId: string): Promise<Calendar | undefined>;

  // Bulk insert for GTFS import
  bulkInsertRoutes(data: InsertRoute[]): Promise<void>;
  bulkInsertStops(data: InsertStop[]): Promise<void>;
  bulkInsertTrips(data: InsertTrip[]): Promise<void>;
  bulkInsertStopTimes(data: InsertStopTime[]): Promise<void>;
  bulkInsertShapes(data: InsertShape[]): Promise<void>;
  bulkInsertCalendar(data: InsertCalendar[]): Promise<void>;
  clearAll(): Promise<void>;
  hasData(): Promise<boolean>;
}

export class PostgresStorage implements IStorage {
  async getAllRoutes(): Promise<Route[]> {
    return db.select().from(routes);
  }

  async getRoute(routeId: string): Promise<Route | undefined> {
    const rows = await db.select().from(routes).where(eq(routes.routeId, routeId)).limit(1);
    return rows[0];
  }

  async getAllStops(): Promise<Stop[]> {
    return db.select().from(stops);
  }

  async getStop(stopId: string): Promise<Stop | undefined> {
    const rows = await db.select().from(stops).where(eq(stops.stopId, stopId)).limit(1);
    return rows[0];
  }

  async getStopsByIds(stopIds: string[]): Promise<Stop[]> {
    if (stopIds.length === 0) return [];
    return db.select().from(stops).where(inArray(stops.stopId, stopIds));
  }

  /**
   * Find stops within radius of a point using PostGIS ST_DWithin.
   * Returns stops ordered by distance ascending.
   */
  async getStopsNearby(
    lat: number,
    lon: number,
    radiusKm: number
  ): Promise<(Stop & { distance: number })[]> {
    const radiusMeters = radiusKm * 1000;
    // ST_DWithin(geography) uses meters; ST_Distance returns meters
    const result = await db.execute(sql`
      SELECT
        s.stop_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        s.stop_code,
        ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography) AS distance
      FROM stops s
      WHERE ST_DWithin(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY distance ASC
      LIMIT 20
    `);
    const rows = (result as any).rows ?? [];
    return rows.map((row: any) => ({
      stopId: row.stop_id,
      stopName: row.stop_name,
      stopLat: row.stop_lat,
      stopLon: row.stop_lon,
      stopCode: row.stop_code,
      distance: Number(row.distance),
    }));
  }

  async getTrip(tripId: string): Promise<Trip | undefined> {
    const rows = await db.select().from(trips).where(eq(trips.tripId, tripId)).limit(1);
    return rows[0];
  }

  async getTripsByRoute(routeId: string): Promise<Trip[]> {
    return db.select().from(trips).where(eq(trips.routeId, routeId));
  }

  async getStopTimesForTrip(tripId: string): Promise<StopTime[]> {
    return db.select().from(stopTimes).where(eq(stopTimes.tripId, tripId));
  }

  async getStopTimesForStop(stopId: string): Promise<StopTime[]> {
    return db.select().from(stopTimes).where(eq(stopTimes.stopId, stopId));
  }

  async getShape(shapeId: string): Promise<Shape[]> {
    return db.select().from(shapes).where(eq(shapes.shapeId, shapeId));
  }

  async getCalendar(serviceId: string): Promise<Calendar | undefined> {
    const rows = await db.select().from(calendar).where(eq(calendar.serviceId, serviceId)).limit(1);
    return rows[0];
  }

  async bulkInsertRoutes(data: InsertRoute[]): Promise<void> {
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO routes (route_id, route_short_name, route_long_name, route_color, route_text_color, route_type)
        VALUES (${item.routeId}, ${item.routeShortName}, ${item.routeLongName}, ${item.routeColor ?? null}, ${item.routeTextColor ?? null}, ${item.routeType ?? null})
        ON CONFLICT (route_id) DO UPDATE SET
          route_short_name = EXCLUDED.route_short_name,
          route_long_name = EXCLUDED.route_long_name,
          route_color = EXCLUDED.route_color,
          route_text_color = EXCLUDED.route_text_color,
          route_type = EXCLUDED.route_type
      `);
    }
  }

  async bulkInsertStops(data: InsertStop[]): Promise<void> {
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_code, location)
        VALUES (
          ${item.stopId},
          ${item.stopName},
          ${item.stopLat},
          ${item.stopLon},
          ${item.stopCode ?? null},
          ST_SetSRID(ST_MakePoint(${item.stopLon}, ${item.stopLat}), 4326)::geography
        )
        ON CONFLICT (stop_id) DO UPDATE SET
          stop_name = EXCLUDED.stop_name,
          stop_lat = EXCLUDED.stop_lat,
          stop_lon = EXCLUDED.stop_lon,
          stop_code = EXCLUDED.stop_code,
          location = EXCLUDED.location
      `);
    }
  }

  async bulkInsertTrips(data: InsertTrip[]): Promise<void> {
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id, shape_id)
        VALUES (${item.tripId}, ${item.routeId}, ${item.serviceId}, ${item.tripHeadsign ?? null}, ${item.directionId ?? null}, ${item.shapeId ?? null})
        ON CONFLICT (trip_id) DO UPDATE SET
          route_id = EXCLUDED.route_id,
          service_id = EXCLUDED.service_id,
          trip_headsign = EXCLUDED.trip_headsign,
          direction_id = EXCLUDED.direction_id,
          shape_id = EXCLUDED.shape_id
      `);
    }
  }

  async bulkInsertStopTimes(data: InsertStopTime[]): Promise<void> {
    // Batch insert without ON CONFLICT (stop_times has auto-increment id)
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence)
        VALUES (${item.tripId}, ${item.stopId}, ${item.arrivalTime}, ${item.departureTime}, ${item.stopSequence})
      `);
    }
  }

  async bulkInsertShapes(data: InsertShape[]): Promise<void> {
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
        VALUES (${item.shapeId}, ${item.shapePtLat}, ${item.shapePtLon}, ${item.shapePtSequence})
      `);
    }
  }

  async bulkInsertCalendar(data: InsertCalendar[]): Promise<void> {
    for (const item of data) {
      await db.execute(sql`
        INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
        VALUES (${item.serviceId}, ${item.monday}, ${item.tuesday}, ${item.wednesday}, ${item.thursday}, ${item.friday}, ${item.saturday}, ${item.sunday}, ${item.startDate}, ${item.endDate})
        ON CONFLICT (service_id) DO UPDATE SET
          monday = EXCLUDED.monday,
          tuesday = EXCLUDED.tuesday,
          wednesday = EXCLUDED.wednesday,
          thursday = EXCLUDED.thursday,
          friday = EXCLUDED.friday,
          saturday = EXCLUDED.saturday,
          sunday = EXCLUDED.sunday,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date
      `);
    }
  }

  async clearAll(): Promise<void> {
    await db.execute(sql`DELETE FROM stop_times`);
    await db.execute(sql`DELETE FROM shapes`);
    await db.execute(sql`DELETE FROM trips`);
    await db.execute(sql`DELETE FROM stops`);
    await db.execute(sql`DELETE FROM routes`);
    await db.execute(sql`DELETE FROM calendar`);
  }

  async hasData(): Promise<boolean> {
    const result = await db.execute(sql`SELECT COUNT(*) AS count FROM routes`);
    const rows = (result as any).rows ?? [];
    return Number(rows[0]?.count ?? 0) > 0;
  }
}

export const storage = new PostgresStorage();
