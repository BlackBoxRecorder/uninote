import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withErrorHandler, ApiError, ValidationUtils } from "@/lib/api-utils";

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  const db = getDatabase();

  const existing = db.select().from(folders).where(eq(folders.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "文件夹不存在");
  }

  const updates: Record<string, unknown> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "名称不能为空");
    if (name.length > ValidationUtils.NAME_MAX) throw new ApiError(400, `名称不能超过${ValidationUtils.NAME_MAX}个字符`);
    if (ValidationUtils.INVALID_CHARS.test(name)) throw new ApiError(400, "名称包含非法字符");
    updates.name = name;
  }

  if (typeof body.sortOrder === "number") {
    updates.sortOrder = body.sortOrder;
  }

  if (typeof body.isExpanded === "boolean") {
    updates.isExpanded = body.isExpanded;
  }

  if (typeof body.isArchived === "boolean") {
    updates.isArchived = body.isArchived;
  }

  // Support moving folder to a new parent (2-level depth validation)
  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      updates.parentId = null;
    } else if (typeof body.parentId === "string") {
      // Cannot set parent to self
      if (body.parentId === id) {
        throw new ApiError(400, "不能将文件夹设为自身的子文件夹");
      }
      const parent = db.select().from(folders).where(eq(folders.id, body.parentId)).get();
      if (!parent) {
        throw new ApiError(400, "父文件夹不存在");
      }
      // Only root-level folders can have children
      if (parent.parentId !== null) {
        throw new ApiError(400, "最多支持两级文件夹");
      }
      // If this folder has children, it cannot become a child itself
      const children = db.select().from(folders).where(eq(folders.parentId, id)).all();
      if (children.length > 0) {
        throw new ApiError(400, "含有子文件夹的文件夹不能移动到其他文件夹下");
      }
      updates.parentId = body.parentId;
    }
  }

  db.update(folders).set(updates).where(eq(folders.id, id)).run();

  const updated = db.select().from(folders).where(eq(folders.id, id)).get();
  return NextResponse.json(updated);
});

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();

  const existing = db.select().from(folders).where(eq(folders.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "文件夹不存在");
  }

  db.delete(folders).where(eq(folders.id, id)).run();
  return NextResponse.json({ success: true });
});
