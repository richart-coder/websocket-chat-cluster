import WebSocket, { WebSocketServer } from "ws";
import Redis from "ioredis";
import { Room } from "./room.js";
import {
  RawMessageSchema,
  MessageSchema,
  ParsedMessageSchema,
} from "./schemas.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const wss = new WebSocketServer({ port: PORT });

wss.on("error", (err) => {
  console.error("WebSocket Server 錯誤:", err);
});

wss.on("listening", () => {
  console.log(`WebSocket Server 已啟動在 port ${PORT}`);
});

const [host, port] = process.env.REDIS_URL
  ? process.env.REDIS_URL.replace("redis://", "").split(":")
  : ["localhost", "6379"];
const redisConfig = {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryDelayOnFailover: 100,
  retryConnectTimeout: 2000,
  host,
  port: parseInt(port, 10),
};

const redisSub = new Redis(redisConfig);
const redisPub = new Redis(redisConfig);

redisSub.on("error", (err) => {
  console.error("Redis Subscriber 連接錯誤:", err);
});

redisSub.on("connect", () => {
  console.log("Redis Subscriber 連接成功");
});

redisSub.on("reconnecting", () => {
  console.log("Redis Subscriber 重新連接中...");
});

redisPub.on("error", (err) => {
  console.error("Redis Publisher 連接錯誤:", err);
});

redisPub.on("connect", () => {
  console.log("Redis Publisher 連接成功");
});

redisPub.on("reconnecting", () => {
  console.log("Redis Publisher 重新連接中...");
});
redisSub.on("message", (channel, message) => {
  room.broadcastToRoom(channel, JSON.parse(message));
});
const room = new Room(redisSub);
const clientHeartbeats = new Map();

class RoomLockManager {
  constructor() {
    this.lockQueues = new Map();
  }

  acquireLock(roomId) {
    return new Promise((resolve) => {
      if (!this.lockQueues.has(roomId)) {
        this.lockQueues.set(roomId, []);
        resolve(() => this.releaseLock(roomId));
      } else {
        this.lockQueues.get(roomId).push(resolve);
      }
    });
  }

  releaseLock(roomId) {
    const queue = this.lockQueues.get(roomId);
    if (queue && queue.length > 0) {
      const nextResolve = queue.shift();
      nextResolve(() => this.releaseLock(roomId));
    } else {
      this.lockQueues.delete(roomId);
    }
  }
}

const roomLockManager = new RoomLockManager();

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_ROOM_ID_LENGTH = 50;
const MAX_SENDER_LENGTH = 50;

function parseMessage(data, ws) {
  try {
    const rawValidation = RawMessageSchema.safeParse(data);
    if (!rawValidation.success) {
      ws.send(
        JSON.stringify({
          error: "Invalid message format",
          details: rawValidation.error.issues,
        }),
      );
      return null;
    }

    const messageStr = data.toString();
    if (messageStr.length > MAX_MESSAGE_LENGTH) {
      ws.send(JSON.stringify({ error: "Message too long" }));
      return null;
    }

    const msg = JSON.parse(messageStr);

    const messageValidation = ParsedMessageSchema.safeParse(msg);
    if (!messageValidation.success) {
      ws.send(
        JSON.stringify({
          error: "Invalid message structure",
          details: messageValidation.error.issues,
        }),
      );
      return null;
    }

    const { roomId, sender, text } = msg;

    if (!roomId || !sender || !text) {
      ws.send(JSON.stringify({ error: "roomId, sender, text required" }));
      return null;
    }

    const validation = MessageSchema.safeParse({ roomId, sender, text });
    if (!validation.success) {
      ws.send(
        JSON.stringify({
          error: "Invalid message format",
          details: validation.error.issues,
        }),
      );
      return null;
    }

    if (
      roomId.length > MAX_ROOM_ID_LENGTH ||
      sender.length > MAX_SENDER_LENGTH
    ) {
      ws.send(JSON.stringify({ error: "roomId or sender too long" }));
      return null;
    }

    if (text.trim().length === 0) {
      ws.send(JSON.stringify({ error: "Text cannot be empty" }));
      return null;
    }

    return { roomId: roomId.trim(), sender: sender.trim(), text: text.trim() };
  } catch (e) {
    console.error("Parse message error:", e);
    ws.send(JSON.stringify({ error: "Invalid JSON" }));
    return null;
  }
}

async function acquireRoomLock(roomId) {
  return await roomLockManager.acquireLock(roomId);
}

async function leaveRoom(ws, roomId) {
  const releaseLock = await acquireRoomLock(roomId);
  try {
    await room.removeClientFromRoom(ws, roomId);
  } finally {
    releaseLock();
  }
}

async function joinRoom(ws, roomId) {
  const releaseLock = await acquireRoomLock(roomId);
  try {
    const connection = await room.getOrCreateConnection(roomId);
    connection.addClient(ws);
  } finally {
    releaseLock();
  }
}

function broadcastMessage(roomId, sender, text) {
  const msgToSend = JSON.stringify({
    sender,
    text,
    time: new Date().toISOString(),
  });
  redisPub.publish(roomId, msgToSend);
}

async function handleDisconnection(ws, roomId) {
  if (!roomId) {
    clientHeartbeats.delete(ws);
    return;
  }

  const releaseLock = await acquireRoomLock(roomId);
  try {
    await room.removeClientFromRoom(ws, roomId);
  } finally {
    releaseLock();
  }

  clientHeartbeats.delete(ws);
}

function startHeartbeatCheck() {
  setInterval(() => {
    const now = Date.now();
    for (const [ws, lastHeartbeat] of clientHeartbeats.entries()) {
      if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
        ws.terminate();
        clientHeartbeats.delete(ws);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function sendHeartbeat(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping" }));
  }
}

startHeartbeatCheck();

wss.on("connection", (ws) => {
  let currentRoom = null;

  clientHeartbeats.set(ws, Date.now());

  const heartbeatInterval = setInterval(() => {
    sendHeartbeat(ws);
  }, HEARTBEAT_INTERVAL);

  async function handleRoomChange(ws, newRoomId) {
    if (currentRoom === newRoomId) return;

    if (currentRoom) {
      await leaveRoom(ws, currentRoom);
    }

    currentRoom = newRoomId;
    await joinRoom(ws, newRoomId);
  }

  ws.on("message", async (data) => {
    clientHeartbeats.set(ws, Date.now());

    const parsedMessage = parseMessage(data, ws);
    if (!parsedMessage) return;

    const { roomId, sender, text } = parsedMessage;

    if (text === "pong") {
      return;
    }

    await handleRoomChange(ws, roomId);
    broadcastMessage(roomId, sender, text);
  });

  ws.on("close", async () => {
    clearInterval(heartbeatInterval);
    clientHeartbeats.delete(ws);
    await handleDisconnection(ws, currentRoom);
  });

  ws.on("error", async (error) => {
    clearInterval(heartbeatInterval);
    clientHeartbeats.delete(ws);
    await handleDisconnection(ws, currentRoom);
  });
});

const SERVER_ID = `server-${process.pid}-${Date.now()}`;

function registerServer() {
  try {
    redisPub.hset(
      "servers",
      SERVER_ID,
      JSON.stringify({
        host: process.env.HOST || "localhost",
        port: PORT,
        pid: process.pid,
        startTime: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Failed to register server:", error);
  }
}

registerServer();

console.log(`WebSocket server with Redis started at ws://localhost:${PORT}`);
