import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { diaries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();
    const diary = db.select().from(diaries).where(eq(diaries.id, id)).get();

    if (!diary) {
      return NextResponse.json({ error: "日记不存在" }, { status: 404 });
    }

    return NextResponse.json(diary);
  } catch (e) {
    console.error("Failed to fetch diary:", e);
    return NextResponse.json({ error: "获取日记失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDatabase();

    const existing = db.select().from(diaries).where(eq(diaries.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "日记不存在" }, { status: 404 });
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
  } catch (e) {
    console.error("Failed to update diary:", e);
    return NextResponse.json({ error: "更新日记失败" }, { status: 500 });
  }
}
