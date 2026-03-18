import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const yearParam = request.nextUrl.searchParams.get("year");

    if (!yearParam || isNaN(Number(yearParam))) {
      return NextResponse.json(
        { error: "缺少 year 参数" },
        { status: 400 }
      );
    }

    const year = Number(yearParam);

    const allDiaries = db
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
      .where(eq(diaries.year, year))
      .orderBy(desc(diaries.weekNumber), asc(diaries.type), desc(diaries.date))
      .all();

    return NextResponse.json({ diaries: allDiaries });
  } catch (e) {
    console.error("Failed to fetch diaries:", e);
    return NextResponse.json(
      { error: "获取日记列表失败" },
      { status: 500 }
    );
  }
}
