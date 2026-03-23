import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const today = body.today;

  if (!today || typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new ApiError(400, "缺少有效的 today 参数");
  }

  const todayDate = parseISO(today);
  const year = getISOWeekYear(todayDate);
  const weekNumber = getISOWeek(todayDate);
  const weekDate = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  const db = getDatabase();
  const now = Date.now();

  // Ensure daily entry
  let daily = db
    .select({
      id: diaries.id,
      type: diaries.type,
      date: diaries.date,
      year: diaries.year,
      weekNumber: diaries.weekNumber,
      wordCount: diaries.wordCount,
      createdAt: diaries.createdAt,
      updatedAt: diaries.updatedAt,
    })
    .from(diaries)
    .where(and(eq(diaries.type, "daily"), eq(diaries.date, today)))
    .get();

  if (!daily) {
    const dailyId = nanoid();
    db.insert(diaries)
      .values({
        id: dailyId,
        type: "daily",
        date: today,
        year,
        weekNumber,
        content: null,
        markdown: null,
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    daily = {
      id: dailyId,
      type: "daily",
      date: today,
      year,
      weekNumber,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Ensure weekly entry
  let weekly = db
    .select({
      id: diaries.id,
      type: diaries.type,
      date: diaries.date,
      year: diaries.year,
      weekNumber: diaries.weekNumber,
      wordCount: diaries.wordCount,
      createdAt: diaries.createdAt,
      updatedAt: diaries.updatedAt,
    })
    .from(diaries)
    .where(and(eq(diaries.type, "weekly"), eq(diaries.date, weekDate)))
    .get();

  if (!weekly) {
    const weeklyId = nanoid();
    db.insert(diaries)
      .values({
        id: weeklyId,
        type: "weekly",
        date: weekDate,
        year,
        weekNumber,
        content: null,
        markdown: null,
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    weekly = {
      id: weeklyId,
      type: "weekly",
      date: weekDate,
      year,
      weekNumber,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  return NextResponse.json({ daily, weekly });
});
