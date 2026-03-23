import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();
  const diary = db.select().from(diaries).where(eq(diaries.id, id)).get();

  if (!diary) {
    throw new ApiError(404, "日记不存在");
  }

  return NextResponse.json(diary);
});

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const db = getDatabase();

  const existing = db.select().from(diaries).where(eq(diaries.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "日记不存在");
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.content !== undefined) {
    updates.content = body.content;
  }

  if (body.markdown !== undefined) {
    updates.markdown = body.markdown;
  }

  if (typeof body.wordCount === "number") {
    updates.wordCount = body.wordCount;
  }

  db.update(diaries).set(updates).where(eq(diaries.id, id)).run();

  const updated = db.select().from(diaries).where(eq(diaries.id, id)).get();
  return NextResponse.json(updated);
});
