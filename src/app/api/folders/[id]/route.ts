import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders } from "@/db/schema";
import { eq } from "drizzle-orm";

const NAME_MAX = 100;
const INVALID_CHARS = /[\/\\:*?"<>|]/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDatabase();

    const existing = db.select().from(folders).where(eq(folders.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
      if (name.length > NAME_MAX) return NextResponse.json({ error: `名称不能超过${NAME_MAX}个字符` }, { status: 400 });
      if (INVALID_CHARS.test(name)) return NextResponse.json({ error: "名称包含非法字符" }, { status: 400 });
      updates.name = name;
    }

    if (typeof body.sortOrder === "number") {
      updates.sortOrder = body.sortOrder;
    }

    if (typeof body.isExpanded === "boolean") {
      updates.isExpanded = body.isExpanded;
    }

    // Support moving folder to a new parent (2-level depth validation)
    if (body.parentId !== undefined) {
      if (body.parentId === null) {
        updates.parentId = null;
      } else if (typeof body.parentId === "string") {
        // Cannot set parent to self
        if (body.parentId === id) {
          return NextResponse.json({ error: "不能将文件夹设为自身的子文件夹" }, { status: 400 });
        }
        const parent = db.select().from(folders).where(eq(folders.id, body.parentId)).get();
        if (!parent) {
          return NextResponse.json({ error: "父文件夹不存在" }, { status: 400 });
        }
        // Only root-level folders can have children
        if (parent.parentId !== null) {
          return NextResponse.json({ error: "最多支持两级文件夹" }, { status: 400 });
        }
        // If this folder has children, it cannot become a child itself
        const children = db.select().from(folders).where(eq(folders.parentId, id)).all();
        if (children.length > 0) {
          return NextResponse.json({ error: "含有子文件夹的文件夹不能移动到其他文件夹下" }, { status: 400 });
        }
        updates.parentId = body.parentId;
      }
    }

    db.update(folders).set(updates).where(eq(folders.id, id)).run();

    const updated = db.select().from(folders).where(eq(folders.id, id)).get();
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Failed to update folder:", e);
    return NextResponse.json({ error: "更新文件夹失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const existing = db.select().from(folders).where(eq(folders.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
    }

    db.delete(folders).where(eq(folders.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete folder:", e);
    return NextResponse.json({ error: "删除文件夹失败" }, { status: 500 });
  }
}
