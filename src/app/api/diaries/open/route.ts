import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getISOWeek,
  getISOWeekYear,
  parseISO,
  isAfter,
  startOfDay,
} from "date-fns";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { type, date } = body;

  if (!type || !["daily", "weekly"].includes(type)) {
    throw new ApiError(400, "无效的 type 参数");
  }

  if (!date || typeof date !== "string") {
    throw new ApiError(400, "缺少 date 参数");
  }

  const today = startOfDay(new Date());

  // Validate not future
  if (type === "daily") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiError(400, "无效的日期格式");
    }
    const targetDate = parseISO(date);
    if (isAfter(targetDate, today)) {
      throw new ApiError(400, "不能创建未来日期的日记");
    }
  } else {
    // weekly: format like '2026-W12'
    if (!/^\d{4}-W\d{2}$/.test(date)) {
      throw new ApiError(400, "无效的周格式");
    }
    // Parse week to check it's not a future week
    const [yearStr, weekStr] = date.split("-W");
    const targetYear = Number(yearStr);
    const targetWeek = Number(weekStr);
    const currentYear = getISOWeekYear(today);
    const currentWeek = getISOWeek(today);
    if (
      targetYear > currentYear ||
      (targetYear === currentYear && targetWeek > currentWeek)
    ) {
      throw new ApiError(400, "不能创建未来周的周记");
    }
  }

  const db = getDatabase();

  // Check if already exists
  const existing = db
    .select()
    .from(diaries)
    .where(and(eq(diaries.type, type), eq(diaries.date, date)))
    .get();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Calculate year and weekNumber
  let year: number;
  let weekNumber: number;

  if (type === "daily") {
    const d = parseISO(date);
    year = getISOWeekYear(d);
    weekNumber = getISOWeek(d);
  } else {
    const [yearStr, weekStr] = date.split("-W");
    year = Number(yearStr);
    weekNumber = Number(weekStr);
  }

  const now = Date.now();
  const id = nanoid();

  db.insert(diaries)
    .values({
      id,
      type,
      date,
      year,
      weekNumber,
      content: null,
      markdown: null,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = db.select().from(diaries).where(eq(diaries.id, id)).get();
  return NextResponse.json(created, { status: 201 });
});
