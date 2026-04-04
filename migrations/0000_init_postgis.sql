-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Routes
CREATE TABLE IF NOT EXISTS "routes" (
  "route_id" text PRIMARY KEY NOT NULL,
  "route_short_name" text NOT NULL,
  "route_long_name" text NOT NULL,
  "route_color" text,
  "route_text_color" text,
  "route_type" integer
);

-- Stops with PostGIS geography column
CREATE TABLE IF NOT EXISTS "stops" (
  "stop_id" text PRIMARY KEY NOT NULL,
  "stop_name" text NOT NULL,
  "stop_lat" real NOT NULL,
  "stop_lon" real NOT NULL,
  "stop_code" text
);

-- Add PostGIS geography(POINT, 4326) column for spatial queries
-- SRID 4326 = WGS84 (lat/lon coordinates used by GPS)
ALTER TABLE stops ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Create spatial index on the geography column
CREATE INDEX IF NOT EXISTS stop_location_gist_idx ON stops USING GIST (location);

-- Backfill location column from existing lat/lon data
UPDATE stops SET location = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)::geography WHERE location IS NULL;

-- Trips
CREATE TABLE IF NOT EXISTS "trips" (
  "trip_id" text PRIMARY KEY NOT NULL,
  "route_id" text NOT NULL,
  "service_id" text NOT NULL,
  "trip_headsign" text,
  "direction_id" integer,
  "shape_id" text
);

-- Stop Times
CREATE TABLE IF NOT EXISTS "stop_times" (
  "id" SERIAL PRIMARY KEY,
  "trip_id" text NOT NULL,
  "stop_id" text NOT NULL,
  "arrival_time" text NOT NULL,
  "departure_time" text NOT NULL,
  "stop_sequence" integer NOT NULL
);

-- Shapes
CREATE TABLE IF NOT EXISTS "shapes" (
  "id" SERIAL PRIMARY KEY,
  "shape_id" text NOT NULL,
  "shape_pt_lat" real NOT NULL,
  "shape_pt_lon" real NOT NULL,
  "shape_pt_sequence" integer NOT NULL
);

-- Calendar
CREATE TABLE IF NOT EXISTS "calendar" (
  "service_id" text PRIMARY KEY NOT NULL,
  "monday" integer NOT NULL,
  "tuesday" integer NOT NULL,
  "wednesday" integer NOT NULL,
  "thursday" integer NOT NULL,
  "friday" integer NOT NULL,
  "saturday" integer NOT NULL,
  "sunday" integer NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL
);
