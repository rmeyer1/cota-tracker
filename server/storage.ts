import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  routes, stops, trips, stopTimes, shapes, calendar,
  type Route, type Stop, type Trip, type StopTime, type Shape, type Calendar,
  type InsertRoute, type InsertStop, type InsertTrip, type InsertStopTime, type InsertShape, type InsertCalendar,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

const sqlite = new Database("cota.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = normal");

export const db = drizzle(sqlite);

export interface IStorage {
  // Routes
  getAllRoutes(): Route[];
  getRoute(routeId: string): Route | undefined;

  // Stops
  getAllStops(): Stop[];
  getStop(stopId: string): Stop | undefined;
  getStopsByIds(stopIds: string[]): Stop[];

  // Trips
  getTrip(tripId: string): Trip | undefined;
  getTripsByRoute(routeId: string): Trip[];

  // Stop Times
  getStopTimesForTrip(tripId: string): StopTime[];
  getStopTimesForStop(stopId: string): StopTime[];

  // Shapes
  getShape(shapeId: string): Shape[];

  // Calendar
  getCalendar(serviceId: string): Calendar | undefined;

  // Bulk insert for GTFS import
  bulkInsertRoutes(data: InsertRoute[]): void;
  bulkInsertStops(data: InsertStop[]): void;
  bulkInsertTrips(data: InsertTrip[]): void;
  bulkInsertStopTimes(data: InsertStopTime[]): void;
  bulkInsertShapes(data: InsertShape[]): void;
  bulkInsertCalendar(data: InsertCalendar[]): void;
  clearAll(): void;
  hasData(): boolean;
}

export class SqliteStorage implements IStorage {
  getAllRoutes(): Route[] {
    return db.select().from(routes).all();
  }

  getRoute(routeId: string): Route | undefined {
    return db.select().from(routes).where(eq(routes.routeId, routeId)).get();
  }

  getAllStops(): Stop[] {
    return db.select().from(stops).all();
  }

  getStop(stopId: string): Stop | undefined {
    return db.select().from(stops).where(eq(stops.stopId, stopId)).get();
  }

  getStopsByIds(stopIds: string[]): Stop[] {
    if (stopIds.length === 0) return [];
    return db.select().from(stops).where(inArray(stops.stopId, stopIds)).all();
  }

  getTrip(tripId: string): Trip | undefined {
    return db.select().from(trips).where(eq(trips.tripId, tripId)).get();
  }

  getTripsByRoute(routeId: string): Trip[] {
    return db.select().from(trips).where(eq(trips.routeId, routeId)).all();
  }

  getStopTimesForTrip(tripId: string): StopTime[] {
    return db.select().from(stopTimes).where(eq(stopTimes.tripId, tripId)).all();
  }

  getStopTimesForStop(stopId: string): StopTime[] {
    return db.select().from(stopTimes).where(eq(stopTimes.stopId, stopId)).all();
  }

  getShape(shapeId: string): Shape[] {
    return db.select().from(shapes).where(eq(shapes.shapeId, shapeId)).all();
  }

  getCalendar(serviceId: string): Calendar | undefined {
    return db.select().from(calendar).where(eq(calendar.serviceId, serviceId)).get();
  }

  bulkInsertRoutes(data: InsertRoute[]): void {
    const stmt = sqlite.prepare(
      `INSERT OR REPLACE INTO routes (route_id, route_short_name, route_long_name, route_color, route_text_color, route_type) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertRoute[]) => {
      for (const item of items) {
        stmt.run(item.routeId, item.routeShortName, item.routeLongName, item.routeColor || null, item.routeTextColor || null, item.routeType || null);
      }
    });
    transaction(data);
  }

  bulkInsertStops(data: InsertStop[]): void {
    const stmt = sqlite.prepare(
      `INSERT OR REPLACE INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_code) VALUES (?, ?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertStop[]) => {
      for (const item of items) {
        stmt.run(item.stopId, item.stopName, item.stopLat, item.stopLon, item.stopCode || null);
      }
    });
    transaction(data);
  }

  bulkInsertTrips(data: InsertTrip[]): void {
    const stmt = sqlite.prepare(
      `INSERT OR REPLACE INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id, shape_id) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertTrip[]) => {
      for (const item of items) {
        stmt.run(item.tripId, item.routeId, item.serviceId, item.tripHeadsign || null, item.directionId || null, item.shapeId || null);
      }
    });
    transaction(data);
  }

  bulkInsertStopTimes(data: InsertStopTime[]): void {
    const stmt = sqlite.prepare(
      `INSERT INTO stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence) VALUES (?, ?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertStopTime[]) => {
      for (const item of items) {
        stmt.run(item.tripId, item.stopId, item.arrivalTime, item.departureTime, item.stopSequence);
      }
    });
    transaction(data);
  }

  bulkInsertShapes(data: InsertShape[]): void {
    const stmt = sqlite.prepare(
      `INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES (?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertShape[]) => {
      for (const item of items) {
        stmt.run(item.shapeId, item.shapePtLat, item.shapePtLon, item.shapePtSequence);
      }
    });
    transaction(data);
  }

  bulkInsertCalendar(data: InsertCalendar[]): void {
    const stmt = sqlite.prepare(
      `INSERT OR REPLACE INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const transaction = sqlite.transaction((items: InsertCalendar[]) => {
      for (const item of items) {
        stmt.run(item.serviceId, item.monday, item.tuesday, item.wednesday, item.thursday, item.friday, item.saturday, item.sunday, item.startDate, item.endDate);
      }
    });
    transaction(data);
  }

  clearAll(): void {
    sqlite.exec("DELETE FROM stop_times");
    sqlite.exec("DELETE FROM shapes");
    sqlite.exec("DELETE FROM trips");
    sqlite.exec("DELETE FROM stops");
    sqlite.exec("DELETE FROM routes");
    sqlite.exec("DELETE FROM calendar");
  }

  hasData(): boolean {
    const result = sqlite.prepare("SELECT COUNT(*) as count FROM routes").get() as any;
    return result?.count > 0;
  }
}

export const storage = new SqliteStorage();
