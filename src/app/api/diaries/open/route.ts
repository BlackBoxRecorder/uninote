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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, date } = body;

    if (!type || !["daily", "weekly"].includes(type)) {
      return NextResponse.json(
        { error: "无效的 type 参数" },
        { status: 400 }
      );
    }

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { error: "缺少 date 参数" },
        { status: 400 }
      );
    }

    const today = startOfDay(new Date());

    // Validate not future
    if (type === "daily") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: "无效的日期格式" },
          { status: 400 }
        );
      }
      const targetDate = parseISO(date);
      if (isAfter(targetDate, today)) {
        return NextResponse.json(
          { error: "不能创建未来日期的日记" },
          { status: 400 }
        );
      }
    } else {
      // weekly: format like '2026-W12'
      if (!/^\d{4}-W\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: "无效的周格式" },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "不能创建未来周的周记" },
          { status: 400 }
        );
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
  } catch (e) {
    console.error("Failed to open diary:", e);
    return NextResponse.json(
      { error: "打开日记失败" },
      { status: 500 }
    );
  }
}
