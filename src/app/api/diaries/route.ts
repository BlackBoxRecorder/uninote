import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const db = getDatabase();
  const yearParam = request.nextUrl.searchParams.get("year");

  if (!yearParam || isNaN(Number(yearParam))) {
    throw new ApiError(400, "缺少 year 参数");
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
});
