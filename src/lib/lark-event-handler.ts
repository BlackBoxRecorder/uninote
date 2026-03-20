/**
 * Shared event handlers for Lark/Feishu events
 * Used by both webhook and websocket modes
 */

import { getDatabase } from "@/db";
import { diaries, ideas } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { format, getISOWeek, getISOWeekYear } from "date-fns";

export interface LarkMessageData {
  message: {
    chat_id: string;
    content: string;
    message_type: string;
  };
  sender?: {
    sender_id?: {
      open_id?: string;
    };
  };
}

/**
 * Handle diary message - create or append to today's diary
 */
export async function handleDiaryMessage(text: string): Promise<void> {
  const db = getDatabase();
  const now = Date.now();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const year = getISOWeekYear(today);
  const weekNumber = getISOWeek(today);

  const existing = db
    .select()
    .from(diaries)
    .where(and(eq(diaries.type, "daily"), eq(diaries.date, todayStr)))
    .get();

  if (!existing) {
    // Create new diary
    const content = JSON.stringify([
      { type: "p", children: [{ text }] },
    ]);
    db.insert(diaries)
      .values({
        id: nanoid(),
        type: "daily",
        date: todayStr,
        year,
        weekNumber,
        content,
        markdown: text,
        wordCount: text.replace(/\s/g, "").length,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    // Append to existing diary
    let contentArr: Array<Record<string, unknown>>;
    try {
      contentArr = existing.content ? JSON.parse(existing.content) : [];
    } catch {
      contentArr = [];
    }
    contentArr.push({ type: "p", children: [{ text }] });

    const newContent = JSON.stringify(contentArr);
    const newMarkdown = existing.markdown
      ? existing.markdown + "\n\n" + text
      : text;
    const newWordCount = newMarkdown.replace(/\s/g, "").length;

    db.update(diaries)
      .set({
        content: newContent,
        markdown: newMarkdown,
        wordCount: newWordCount,
        updatedAt: now,
      })
      .where(eq(diaries.id, existing.id))
      .run();
  }
}

/**
 * Handle idea message - create a new idea
 */
export async function handleIdeaMessage(text: string): Promise<void> {
  const db = getDatabase();
  const now = Date.now();
  db.insert(ideas)
    .values({ id: nanoid(), content: text, createdAt: now, updatedAt: now })
    .run();
}

/**
 * Process incoming message and route to appropriate handler
 * @returns true if message was processed, false otherwise
 */
export async function processMessage(msgText: string): Promise<boolean> {
  msgText = msgText.trim();
  if (!msgText) {
    return false;
  }

  // Route message based on prefix
  if (msgText.startsWith("日记：") || msgText.startsWith("日记:")) {
    const diaryText = msgText.replace(/^日记[：:]/, "").trim();
    if (diaryText) {
      await handleDiaryMessage(diaryText);
      console.log("[lark] Created/appended diary entry");
      return true;
    }
  } else {
    await handleIdeaMessage(msgText);
    console.log("[lark] Created idea entry");
    return true;
  }

  return false;
}
