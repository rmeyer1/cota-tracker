/**
 * WebSocket server for real-time vehicle updates.
 * 
 * Clients connect to /ws/vehicles and receive immediate updates
 * whenever the server polls new vehicle positions from COTA GTFS-RT.
 * 
 * Falls back to graceful close if no upgrade path is available.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export interface VehicleUpdate {
  type: "vehicle_update";
  timestamp: number;
  vehicles: unknown[];
  vehicleCount: number;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  timestamp: number;
}

export type WSMessage = VehicleUpdate | HeartbeatMessage;

let wss: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_INTERVAL_MS = 30_000;
const VEHICLE_UPDATE_CHANNEL = "cota:vehicle:updates";

/**
 * Initialize WebSocket server attached to an HTTP server.
 * Safe to call multiple times — only initializes once.
 */
export function initWebSocket(server: Server): void {
  if (wss) {
    console.log("[WS] Already initialized");
    return;
  }

  wss = new WebSocketServer({
    server,
    path: "/ws/vehicles",
  });

  wss.on("connection", (ws: WebSocket) => {
    const clientId = Math.random().toString(36).slice(2, 9);
    console.log(`[WS] Client connected: ${clientId}, total: ${wss!.clients.size}`);

    ws.on("error", (err) => {
      console.error(`[WS] Client ${clientId} error:`, err.message);
    });

    ws.on("close", () => {
      console.log(`[WS] Client disconnected: ${clientId}, total: ${wss!.clients.size}`);
    });

    // Send initial connection acknowledgment
    send(ws, { type: "heartbeat", timestamp: Date.now() });
  });

  wss.on("error", (err) => {
    console.error("[WS] Server error:", err.message);
  });

  // Start heartbeat to keep connections alive
  heartbeatInterval = setInterval(() => {
    if (!wss) return;
    const msg: HeartbeatMessage = { type: "heartbeat", timestamp: Date.now() };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  console.log("[WS] WebSocket server initialized on /ws/vehicles");
}

/**
 * Broadcast a vehicle update to all connected clients.
 * Called by gtfs-realtime.ts after each successful poll.
 */
export function broadcastVehicleUpdate(
  vehicles: unknown[],
  timestamp: number = Date.now()
): void {
  if (!wss) return;

  const message: VehicleUpdate = {
    type: "vehicle_update",
    timestamp,
    vehicles,
    vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
  };

  const payload = JSON.stringify(message);
  let sent = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  });

  if (sent > 0) {
    console.log(`[WS] Broadcast vehicle update to ${sent} client(s)`);
  }
}

/**
 * Send a message to a specific WebSocket client.
 */
function send(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Return the number of currently connected clients.
 */
export function getClientCount(): number {
  return wss ? wss.clients.size : 0;
}

/**
 * Check if WebSocket server is running.
 */
export function isWebSocketAvailable(): boolean {
  return wss !== null;
}

/**
 * Gracefully shut down the WebSocket server.
 */
export function closeWebSocket(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (wss) {
    wss.close(() => {
      console.log("[WS] Server closed");
    });
    wss = null;
  }
}
