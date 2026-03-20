/**
 * Lark WebSocket Long Connection Client
 * 
 * This script establishes a WebSocket long connection to Lark/Feishu
 * for receiving events without requiring a public webhook URL.
 * 
 * Usage:
 *   - Set LARK_EVENT_MODE=websocket in .env
 *   - Run: npm run lark:ws
 *   - Or run alongside Next.js: npm run dev:ws
 */

import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { isLarkConfigured, getAllowedUserIds, getEncryptKey } from "../src/lib/lark";
import { processMessage, LarkMessageData } from "../src/lib/lark-event-handler";

// Check if Lark is configured
if (!isLarkConfigured()) {
  console.error("[lark:ws] Lark is not configured. Please set LARK_APP_ID and LARK_APP_SECRET");
  process.exit(1);
}

const appId = process.env.LARK_APP_ID!;
const appSecret = process.env.LARK_APP_SECRET!;
const allowedUserIds = getAllowedUserIds();
const encryptKey = getEncryptKey();

console.log("[lark:ws] Starting WebSocket client...");
console.log(`[lark:ws] App ID: ${appId.substring(0, 8)}...`);
console.log(`[lark:ws] Allowed users: ${allowedUserIds.size > 0 ? Array.from(allowedUserIds).join(", ") : "all"}`);

// Create event dispatcher
const eventDispatcher = new lark.EventDispatcher({
  encryptKey,
  loggerLevel: lark.LoggerLevel.info,
}).register({
  "im.message.receive_v1": async (data: LarkMessageData) => {
    try {
      // Check sender is allowed
      const senderId = data.sender?.sender_id?.open_id;
      if (allowedUserIds.size > 0 && senderId && !allowedUserIds.has(senderId)) {
        console.log(`[lark:ws] Ignored message from unauthorized user: ${senderId}`);
        return;
      }

      // Only handle text messages
      if (data.message?.message_type !== "text") {
        return;
      }

      // Parse message content
      let msgText: string;
      try {
        const parsed = JSON.parse(data.message.content);
        msgText = parsed.text || "";
      } catch {
        return;
      }

      await processMessage(msgText);
    } catch (error) {
      console.error("[lark:ws] Error handling message:", error);
    }
  },
});

// Create WebSocket client
const wsClient = new lark.WSClient({
  appId,
  appSecret,
  domain: lark.Domain.Feishu,
  loggerLevel: lark.LoggerLevel.info,
  autoReconnect: true,
});

// Handle graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[lark:ws] Received ${signal}, closing connection...`);
  wsClient.close();
  console.log("[lark:ws] Connection closed");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Start the WebSocket connection
console.log("[lark:ws] Connecting to Lark WebSocket server...");

wsClient.start({
  eventDispatcher,
}).then(() => {
  console.log("[lark:ws] WebSocket connection established");
}).catch((error) => {
  console.error("[lark:ws] Failed to establish WebSocket connection:", error);
  process.exit(1);
});
