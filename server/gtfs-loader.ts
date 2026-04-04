import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";

const GTFS_URL = "https://www.cota.com/data/cota.gtfs.zip";
const GTFS_DIR = path.join(process.cwd(), "gtfs-data");
const GTFS_ZIP = path.join(GTFS_DIR, "cota.gtfs.zip");

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Handle BOM
  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xFEFF) {
    headerLine = headerLine.slice(1);
  }
  
  const headers = headerLine.split(",").map(h => h.trim().replace(/"/g, ""));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parse (handles quoted fields)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

export async function downloadAndLoadGtfs(): Promise<void> {
  console.log("[GTFS] Starting GTFS static data load...");
  
  if (!fs.existsSync(GTFS_DIR)) {
    fs.mkdirSync(GTFS_DIR, { recursive: true });
  }
  
  // Download the GTFS zip
  console.log("[GTFS] Downloading GTFS zip from COTA...");
  const response = await fetch(GTFS_URL);
  if (!response.ok) {
    throw new Error(`Failed to download GTFS: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(GTFS_ZIP, buffer);
  console.log(`[GTFS] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  
  // Extract
  const zip = new AdmZip(GTFS_ZIP);
  zip.extractAllTo(GTFS_DIR, true);
  console.log("[GTFS] Extracted zip");
  
  // Clear existing data
  await storage.clearAll();
  
  // Load routes
  const routesFile = path.join(GTFS_DIR, "routes.txt");
  if (fs.existsSync(routesFile)) {
    const data = parseCsv(fs.readFileSync(routesFile, "utf-8"));
    const routeData = data.map(r => ({
      routeId: r.route_id,
      routeShortName: r.route_short_name || r.route_id,
      routeLongName: r.route_long_name || "",
      routeColor: r.route_color || null,
      routeTextColor: r.route_text_color || null,
      routeType: r.route_type ? parseInt(r.route_type) : null,
    }));
    await storage.bulkInsertRoutes(routeData);
    console.log(`[GTFS] Loaded ${routeData.length} routes`);
  }
  
  // Load stops
  const stopsFile = path.join(GTFS_DIR, "stops.txt");
  if (fs.existsSync(stopsFile)) {
    const data = parseCsv(fs.readFileSync(stopsFile, "utf-8"));
    const stopData = data.filter(s => s.stop_lat && s.stop_lon).map(s => ({
      stopId: s.stop_id,
      stopName: s.stop_name || "Unknown Stop",
      stopLat: parseFloat(s.stop_lat),
      stopLon: parseFloat(s.stop_lon),
      stopCode: s.stop_code || null,
    }));
    await storage.bulkInsertStops(stopData);
    console.log(`[GTFS] Loaded ${stopData.length} stops`);
  }
  
  // Load trips
  const tripsFile = path.join(GTFS_DIR, "trips.txt");
  if (fs.existsSync(tripsFile)) {
    const data = parseCsv(fs.readFileSync(tripsFile, "utf-8"));
    const tripData = data.map(t => ({
      tripId: t.trip_id,
      routeId: t.route_id,
      serviceId: t.service_id,
      tripHeadsign: t.trip_headsign || null,
      directionId: t.direction_id ? parseInt(t.direction_id) : null,
      shapeId: t.shape_id || null,
    }));
    await storage.bulkInsertTrips(tripData);
    console.log(`[GTFS] Loaded ${tripData.length} trips`);
  }
  
  // Load shapes (route geometry for drawing lines on map)
  const shapesFile = path.join(GTFS_DIR, "shapes.txt");
  if (fs.existsSync(shapesFile)) {
    const data = parseCsv(fs.readFileSync(shapesFile, "utf-8"));
    const shapeData = data.map(s => ({
      shapeId: s.shape_id,
      shapePtLat: parseFloat(s.shape_pt_lat),
      shapePtLon: parseFloat(s.shape_pt_lon),
      shapePtSequence: parseInt(s.shape_pt_sequence),
    }));
    // Insert in chunks
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < shapeData.length; i += CHUNK_SIZE) {
      await storage.bulkInsertShapes(shapeData.slice(i, i + CHUNK_SIZE));
    }
    console.log(`[GTFS] Loaded ${shapeData.length} shape points`);
  }

  // Load stop_times (big file, only load what we need)
  const stopTimesFile = path.join(GTFS_DIR, "stop_times.txt");
  if (fs.existsSync(stopTimesFile)) {
    const data = parseCsv(fs.readFileSync(stopTimesFile, "utf-8"));
    const stData = data.map(st => ({
      tripId: st.trip_id,
      stopId: st.stop_id,
      arrivalTime: st.arrival_time || "",
      departureTime: st.departure_time || "",
      stopSequence: parseInt(st.stop_sequence) || 0,
    }));
    const CHUNK_SIZE = 5000;
    for (let i = 0; i < stData.length; i += CHUNK_SIZE) {
      await storage.bulkInsertStopTimes(stData.slice(i, i + CHUNK_SIZE));
    }
    console.log(`[GTFS] Loaded ${stData.length} stop times`);
  }
  
  // Load calendar
  const calendarFile = path.join(GTFS_DIR, "calendar.txt");
  if (fs.existsSync(calendarFile)) {
    const data = parseCsv(fs.readFileSync(calendarFile, "utf-8"));
    const calData = data.map(c => ({
      serviceId: c.service_id,
      monday: parseInt(c.monday) || 0,
      tuesday: parseInt(c.tuesday) || 0,
      wednesday: parseInt(c.wednesday) || 0,
      thursday: parseInt(c.thursday) || 0,
      friday: parseInt(c.friday) || 0,
      saturday: parseInt(c.saturday) || 0,
      sunday: parseInt(c.sunday) || 0,
      startDate: c.start_date,
      endDate: c.end_date,
    }));
    await storage.bulkInsertCalendar(calData);
    console.log(`[GTFS] Loaded ${calData.length} calendar entries`);
  }
  
  console.log("[GTFS] Static data load complete!");
}
