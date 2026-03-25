import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// GTFS Routes
export const routes = sqliteTable("routes", {
  routeId: text("route_id").primaryKey(),
  routeShortName: text("route_short_name").notNull(),
  routeLongName: text("route_long_name").notNull(),
  routeColor: text("route_color"),
  routeTextColor: text("route_text_color"),
  routeType: integer("route_type"),
});

// GTFS Stops
export const stops = sqliteTable("stops", {
  stopId: text("stop_id").primaryKey(),
  stopName: text("stop_name").notNull(),
  stopLat: real("stop_lat").notNull(),
  stopLon: real("stop_lon").notNull(),
  stopCode: text("stop_code"),
});

// GTFS Trips
export const trips = sqliteTable("trips", {
  tripId: text("trip_id").primaryKey(),
  routeId: text("route_id").notNull(),
  serviceId: text("service_id").notNull(),
  tripHeadsign: text("trip_headsign"),
  directionId: integer("direction_id"),
  shapeId: text("shape_id"),
});

// GTFS Stop Times
export const stopTimes = sqliteTable("stop_times", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripId: text("trip_id").notNull(),
  stopId: text("stop_id").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  departureTime: text("departure_time").notNull(),
  stopSequence: integer("stop_sequence").notNull(),
});

// GTFS Shapes (route geometry)
export const shapes = sqliteTable("shapes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shapeId: text("shape_id").notNull(),
  shapePtLat: real("shape_pt_lat").notNull(),
  shapePtLon: real("shape_pt_lon").notNull(),
  shapePtSequence: integer("shape_pt_sequence").notNull(),
});

// GTFS Calendar
export const calendar = sqliteTable("calendar", {
  serviceId: text("service_id").primaryKey(),
  monday: integer("monday").notNull(),
  tuesday: integer("tuesday").notNull(),
  wednesday: integer("wednesday").notNull(),
  thursday: integer("thursday").notNull(),
  friday: integer("friday").notNull(),
  saturday: integer("saturday").notNull(),
  sunday: integer("sunday").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

// Types
export type Route = typeof routes.$inferSelect;
export type Stop = typeof stops.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type StopTime = typeof stopTimes.$inferSelect;
export type Shape = typeof shapes.$inferSelect;
export type Calendar = typeof calendar.$inferSelect;

// Insert schemas
export const insertRouteSchema = createInsertSchema(routes);
export const insertStopSchema = createInsertSchema(stops);
export const insertTripSchema = createInsertSchema(trips);
export const insertStopTimeSchema = createInsertSchema(stopTimes).omit({ id: true });
export const insertShapeSchema = createInsertSchema(shapes).omit({ id: true });
export const insertCalendarSchema = createInsertSchema(calendar);

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type InsertStop = z.infer<typeof insertStopSchema>;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type InsertStopTime = z.infer<typeof insertStopTimeSchema>;
export type InsertShape = z.infer<typeof insertShapeSchema>;
export type InsertCalendar = z.infer<typeof insertCalendarSchema>;
