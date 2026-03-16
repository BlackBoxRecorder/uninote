import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";

const TITLE_MAX = 100;
const INVALID_CHARS = /[\/\\:*?"<>|]/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();
    const note = db.select().from(notes).where(eq(notes.id, id)).get();

    if (!note) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (e) {
    console.error("Failed to fetch note:", e);
    return NextResponse.json({ error: "获取笔记失败" }, { status: 500 });
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

    const existing = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
      if (title.length > TITLE_MAX) return NextResponse.json({ error: `标题不能超过${TITLE_MAX}个字符` }, { status: 400 });
      if (INVALID_CHARS.test(title)) return NextResponse.json({ error: "标题包含非法字符" }, { status: 400 });
      updates.title = title;
    }

    if (body.content !== undefined) {
      updates.content = body.content;
    }

    if (body.markdown !== undefined) {
      updates.markdown = body.markdown;
    }

    if (typeof body.wordCount === "number") {
      updates.wordCount = body.wordCount;
    }

    if (typeof body.sortOrder === "number") {
      updates.sortOrder = body.sortOrder;
    }

    // Allow moving to a folder or setting to root (null)
    if (body.folderId !== undefined) {
      updates.folderId = typeof body.folderId === "string" ? body.folderId : null;
    }

    db.update(notes).set(updates).where(eq(notes.id, id)).run();

    const updated = db.select().from(notes).where(eq(notes.id, id)).get();
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Failed to update note:", e);
    return NextResponse.json({ error: "更新笔记失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const existing = db.select().from(notes).where(eq(notes.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    db.delete(notes).where(eq(notes.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete note:", e);
    return NextResponse.json({ error: "删除笔记失败" }, { status: 500 });
  }
}
