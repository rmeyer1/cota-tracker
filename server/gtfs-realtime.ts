import protobuf from "protobufjs";
import path from "path";
import {
  cacheVehicles,
  cacheTripUpdates,
  cacheAlerts,
  publishVehicleUpdate,
  isRedisAvailable,
} from "./redis-cache";

const VEHICLE_POSITIONS_URL = "https://gtfs-rt.cota.vontascloud.com/TMGTFSRealTimeWebService/Vehicle/VehiclePositions.pb";
const TRIP_UPDATES_URL = "https://gtfs-rt.cota.vontascloud.com/TMGTFSRealTimeWebService/TripUpdate/TripUpdates.pb";
const ALERTS_URL = "https://gtfs-rt.cota.vontascloud.com/TMGTFSRealTimeWebService/Alert/Alerts.pb";

export interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  timestamp: number;
  label: string;
  currentStopSequence: number;
  stopId: string;
  currentStatus: string;
}

export interface TripUpdate {
  tripId: string;
  routeId: string;
  stopTimeUpdates: StopTimeUpdate[];
}

export interface StopTimeUpdate {
  stopId: string;
  stopSequence: number;
  arrivalDelay: number;
  departureDelay: number;
}

export interface ServiceAlert {
  id: string;
  headerText: string;
  descriptionText: string;
  cause: string;
  effect: string;
  routeIds: string[];
  stopIds: string[];
  activePeriods: { start: number; end: number }[];
}

// Load GTFS-RT proto
let gtfsRealtimeProto: protobuf.Root | null = null;

async function getProto(): Promise<protobuf.Root> {
  if (gtfsRealtimeProto) return gtfsRealtimeProto;
  
  // Use the standard GTFS-realtime proto definition
  const protoContent = `
syntax = "proto2";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional Incrementality incrementality = 2 [default = FULL_DATASET];
  optional uint64 timestamp = 3;
  enum Incrementality {
    FULL_DATASET = 0;
    DIFFERENTIAL = 1;
  }
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;

  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional string stop_id = 4;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
    
    enum ScheduleRelationship {
      SCHEDULED = 0;
      SKIPPED = 1;
      NO_DATA = 2;
    }
  }

  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
    optional int32 uncertainty = 3;
  }
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;
  optional CongestionLevel congestion_level = 6;
  optional OccupancyStatus occupancy_status = 9;
  
  enum VehicleStopStatus {
    INCOMING_AT = 0;
    STOPPED_AT = 1;
    IN_TRANSIT_TO = 2;
  }
  
  enum CongestionLevel {
    UNKNOWN_CONGESTION_LEVEL = 0;
    RUNNING_SMOOTHLY = 1;
    STOP_AND_GO = 2;
    CONGESTION = 3;
    SEVERE_CONGESTION = 4;
  }

  enum OccupancyStatus {
    EMPTY = 0;
    MANY_SEATS_AVAILABLE = 1;
    FEW_SEATS_AVAILABLE = 2;
    STANDING_ROOM_ONLY = 3;
    CRUSHED_STANDING_ROOM_ONLY = 4;
    FULL = 5;
    NOT_ACCEPTING_PASSENGERS = 6;
  }
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;
  
  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }
  
  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
  }
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  optional ScheduleRelationship schedule_relationship = 4;
  
  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

message TranslatedString {
  repeated Translation translation = 1;
  message Translation {
    required string text = 1;
    optional string language = 2;
  }
}
`;
  
  gtfsRealtimeProto = protobuf.parse(protoContent).root;
  return gtfsRealtimeProto;
}

// In-memory cache
let cachedVehicles: VehiclePosition[] = [];
let cachedTripUpdates: TripUpdate[] = [];
let cachedAlerts: ServiceAlert[] = [];
let lastFetchTime = 0;

export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  try {
    const proto = await getProto();
    const FeedMessage = proto.lookupType("transit_realtime.FeedMessage");
    
    const response = await fetch(VEHICLE_POSITIONS_URL);
    if (!response.ok) {
      console.error(`[GTFS-RT] Vehicle positions fetch failed: ${response.status}`);
      return cachedVehicles;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = FeedMessage.decode(buffer) as any;
    
    const vehicles: VehiclePosition[] = [];
    for (const entity of decoded.entity || []) {
      const v = entity.vehicle;
      if (!v?.position) continue;
      
      const statusMap: Record<number, string> = { 0: "INCOMING_AT", 1: "STOPPED_AT", 2: "IN_TRANSIT_TO" };
      
      vehicles.push({
        vehicleId: v.vehicle?.id || entity.id || "",
        tripId: v.trip?.tripId || "",
        routeId: v.trip?.routeId || "",
        latitude: v.position.latitude,
        longitude: v.position.longitude,
        bearing: v.position.bearing || 0,
        speed: v.position.speed || 0,
        timestamp: Number(v.timestamp || 0),
        label: v.vehicle?.label || "",
        currentStopSequence: v.currentStopSequence || 0,
        stopId: v.stopId || "",
        currentStatus: statusMap[v.currentStatus] || "IN_TRANSIT_TO",
      });
    }
    
    cachedVehicles = vehicles;
    lastFetchTime = Date.now();
    console.log(`[GTFS-RT] Fetched ${vehicles.length} vehicle positions`);
    
    // Cache in Redis and publish update
    await cacheVehicles(vehicles);
    if (isRedisAvailable()) await publishVehicleUpdate();
    
    return vehicles;
  } catch (err) {
    console.error("[GTFS-RT] Error fetching vehicle positions:", err);
    return cachedVehicles;
  }
}

export async function fetchTripUpdates(): Promise<TripUpdate[]> {
  try {
    const proto = await getProto();
    const FeedMessage = proto.lookupType("transit_realtime.FeedMessage");
    
    const response = await fetch(TRIP_UPDATES_URL);
    if (!response.ok) {
      console.error(`[GTFS-RT] Trip updates fetch failed: ${response.status}`);
      return cachedTripUpdates;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = FeedMessage.decode(buffer) as any;
    
    const updates: TripUpdate[] = [];
    for (const entity of decoded.entity || []) {
      const tu = entity.tripUpdate;
      if (!tu) continue;
      
      updates.push({
        tripId: tu.trip?.tripId || "",
        routeId: tu.trip?.routeId || "",
        stopTimeUpdates: (tu.stopTimeUpdate || []).map((stu: any) => ({
          stopId: stu.stopId || "",
          stopSequence: stu.stopSequence || 0,
          arrivalDelay: stu.arrival?.delay || 0,
          departureDelay: stu.departure?.delay || 0,
        })),
      });
    }
    
    cachedTripUpdates = updates;
    console.log(`[GTFS-RT] Fetched ${updates.length} trip updates`);
    
    // Cache in Redis
    await cacheTripUpdates(updates);
    
    return updates;
  } catch (err) {
    console.error("[GTFS-RT] Error fetching trip updates:", err);
    return cachedTripUpdates;
  }
}

export function getCachedVehicles(): VehiclePosition[] {
  return cachedVehicles;
}

export function getCachedTripUpdates(): TripUpdate[] {
  return cachedTripUpdates;
}

export function getCachedAlerts(): ServiceAlert[] {
  return cachedAlerts;
}

export function getLastFetchTime(): number {
  return lastFetchTime;
}

export async function fetchServiceAlerts(): Promise<ServiceAlert[]> {
  try {
    const proto = await getProto();
    const FeedMessage = proto.lookupType("transit_realtime.FeedMessage");
    
    const response = await fetch(ALERTS_URL);
    if (!response.ok) {
      console.error(`[GTFS-RT] Alerts fetch failed: ${response.status}`);
      return cachedAlerts;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const decoded = FeedMessage.decode(buffer) as any;
    
    const causeMap: Record<number, string> = {
      1: "UNKNOWN", 2: "OTHER", 3: "TECHNICAL_PROBLEM", 4: "STRIKE",
      5: "DEMONSTRATION", 6: "ACCIDENT", 7: "HOLIDAY", 8: "WEATHER",
      9: "MAINTENANCE", 10: "CONSTRUCTION", 11: "POLICE_ACTIVITY", 12: "MEDICAL_EMERGENCY",
    };
    const effectMap: Record<number, string> = {
      1: "NO_SERVICE", 2: "REDUCED_SERVICE", 3: "SIGNIFICANT_DELAYS", 4: "DETOUR",
      5: "ADDITIONAL_SERVICE", 6: "MODIFIED_SERVICE", 7: "OTHER", 8: "UNKNOWN", 9: "STOP_MOVED",
    };
    
    const alerts: ServiceAlert[] = [];
    for (const entity of decoded.entity || []) {
      const a = entity.alert;
      if (!a) continue;
      
      const headerText = a.headerText?.translation?.[0]?.text || "";
      const descriptionText = a.descriptionText?.translation?.[0]?.text || "";
      const routeIds: string[] = [];
      const stopIds: string[] = [];
      
      for (const ie of a.informedEntity || []) {
        if (ie.routeId) routeIds.push(ie.routeId);
        if (ie.stopId) stopIds.push(ie.stopId);
      }
      
      const activePeriods = (a.activePeriod || []).map((ap: any) => ({
        start: Number(ap.start || 0),
        end: Number(ap.end || 0),
      }));
      
      alerts.push({
        id: entity.id,
        headerText,
        descriptionText,
        cause: causeMap[a.cause] || "UNKNOWN",
        effect: effectMap[a.effect] || "UNKNOWN",
        routeIds,
        stopIds,
        activePeriods,
      });
    }
    
    cachedAlerts = alerts;
    console.log(`[GTFS-RT] Fetched ${alerts.length} service alerts`);
    
    // Cache in Redis
    await cacheAlerts(alerts);
    
    return alerts;
  } catch (err) {
    console.error("[GTFS-RT] Error fetching service alerts:", err);
    return cachedAlerts;
  }
}

// Start polling
let pollInterval: NodeJS.Timeout | null = null;

export function startPolling(intervalMs = 15000): void {
  console.log(`[GTFS-RT] Starting real-time polling every ${intervalMs / 1000}s`);
  
  // Fetch immediately
  fetchVehiclePositions();
  fetchTripUpdates();
  fetchServiceAlerts();
  
  // Then poll
  pollInterval = setInterval(async () => {
    await fetchVehiclePositions();
    await fetchTripUpdates();
    await fetchServiceAlerts();
  }, intervalMs);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
