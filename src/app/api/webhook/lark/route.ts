import { NextRequest, NextResponse } from "next/server";
import {
  getVerificationToken,
  getAllowedUserIds,
  isLarkConfigured,
} from "@/lib/lark";
import { processMessage } from "@/lib/lark-event-handler";

// --- Event deduplication (in-memory, 5min TTL) ---
const processedEvents = new Map<string, number>();
const EVENT_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > EVENT_TTL) processedEvents.delete(id);
  }
}, 60 * 1000);

function isDuplicate(eventId: string): boolean {
  if (!eventId) return false;
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, Date.now());
  return false;
}

// --- Main webhook handler ---
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. URL verification challenge
    if (body.type === "url_verification") {
      const token = body.token;
      if (token !== getVerificationToken()) {
        console.warn("[lark webhook] url_verification token mismatch");
        return NextResponse.json({});
      }
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Check if Lark is configured
    if (!isLarkConfigured()) {
      return NextResponse.json({ msg: "not configured" });
    }

    // 3. Detect encrypted payload
    if (body.encrypt) {
      console.warn(
        "[lark webhook] Received encrypted payload. Please configure LARK_ENCRYPT_KEY or disable encryption in Lark console."
      );
      return NextResponse.json({});
    }

    // 4. Verify token (v2.0 schema)
    const headerToken = body.header?.token;
    if (headerToken && headerToken !== getVerificationToken()) {
      console.warn("[lark webhook] verification token mismatch");
      return NextResponse.json({});
    }

    // 5. Event deduplication
    const eventId = body.header?.event_id;
    if (isDuplicate(eventId)) {
      return NextResponse.json({});
    }

    // 6. Only handle message events
    const eventType = body.header?.event_type;
    if (eventType !== "im.message.receive_v1") {
      return NextResponse.json({});
    }

    // 7. Check sender is allowed
    const senderId = body.event?.sender?.sender_id?.open_id;
    const allowedIds = getAllowedUserIds();
    if (allowedIds.size > 0 && !allowedIds.has(senderId)) {
      return NextResponse.json({});
    }

    // 8. Only handle text messages
    const message = body.event?.message;
    if (message?.message_type !== "text") {
      return NextResponse.json({});
    }

    // 9. Parse message content
    let msgText: string;
    try {
      const parsed = JSON.parse(message.content);
      msgText = parsed.text || "";
    } catch {
      return NextResponse.json({});
    }

    // 10. Process message using shared handler
    await processMessage(msgText);

    return NextResponse.json({});
  } catch (e) {
    console.error("[lark webhook] Error processing event:", e);
    // Always return 200 to avoid Lark retries
    return NextResponse.json({});
  }
}
