import * as lark from "@larksuiteoapi/node-sdk";

let client: lark.Client | null = null;
let wsClient: lark.WSClient | null = null;

export type LarkEventMode = "webhook" | "websocket";

export function getLarkClient(): lark.Client {
  if (!client) {
    const appId = process.env.LARK_APP_ID;
    const appSecret = process.env.LARK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("LARK_APP_ID and LARK_APP_SECRET are required");
    }
    client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }
  return client;
}

export function isLarkConfigured(): boolean {
  return !!(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET);
}

export function getVerificationToken(): string {
  return process.env.LARK_VERIFICATION_TOKEN || "";
}

export function getAllowedUserIds(): Set<string> {
  const ids = process.env.LARK_ALLOWED_USER_IDS || "";
  return new Set(
    ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function getFolderToken(): string {
  return process.env.LARK_FOLDER_TOKEN || "";
}

/**
 * Get the event mode from environment
 * @returns "webhook" or "websocket", defaults to "webhook"
 */
export function getLarkEventMode(): LarkEventMode {
  const mode = process.env.LARK_EVENT_MODE?.toLowerCase();
  if (mode === "websocket") {
    return "websocket";
  }
  return "webhook";
}

/**
 * Get the encrypt key for message decryption
 */
export function getEncryptKey(): string {
  return process.env.LARK_ENCRYPT_KEY || "";
}

/**
 * Create or get the WebSocket client for long connection mode
 */
export function getWSClient(): lark.WSClient {
  if (!wsClient) {
    const appId = process.env.LARK_APP_ID;
    const appSecret = process.env.LARK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("LARK_APP_ID and LARK_APP_SECRET are required for WebSocket mode");
    }
    wsClient = new lark.WSClient({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
      autoReconnect: true,
    });
  }
  return wsClient;
}

/**
 * Close the WebSocket client
 */
export function closeWSClient(): void {
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
}
