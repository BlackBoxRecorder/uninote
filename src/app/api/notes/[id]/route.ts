import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withErrorHandler, ApiError, ValidationUtils } from "@/lib/api-utils";

export const GET = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();
  const note = db.select().from(notes).where(eq(notes.id, id)).get();

  if (!note) {
    throw new ApiError(404, "笔记不存在");
  }

  return NextResponse.json(note);
});

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const db = getDatabase();

  const existing = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "笔记不存在");
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new ApiError(400, "标题不能为空");
    if (title.length > ValidationUtils.NAME_MAX) throw new ApiError(400, `标题不能超过${ValidationUtils.NAME_MAX}个字符`);
    if (ValidationUtils.INVALID_CHARS.test(title)) throw new ApiError(400, "标题包含非法字符");
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
});

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();

  const existing = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "笔记不存在");
  }

  db.delete(notes).where(eq(notes.id, id)).run();
  return NextResponse.json({ success: true });
});
