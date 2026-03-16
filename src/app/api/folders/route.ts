import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const NAME_MAX = 100;
const INVALID_CHARS = /[\/\\:*?"<>|]/;

function validateName(name: unknown): string | null {
  if (!name || typeof name !== "string") return "名称不能为空";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "名称不能为空";
  if (trimmed.length > NAME_MAX) return `名称不能超过${NAME_MAX}个字符`;
  if (INVALID_CHARS.test(trimmed)) return "名称包含非法字符";
  return null;
}

export async function GET() {
  try {
    const db = getDatabase();
    const allFolders = db
      .select()
      .from(folders)
      .orderBy(asc(folders.sortOrder), asc(folders.createdAt))
      .all();
    return NextResponse.json(allFolders);
  } catch (e) {
    console.error("Failed to fetch folders:", e);
    return NextResponse.json({ error: "获取文件夹失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const err = validateName(body.name);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const db = getDatabase();
    const now = Date.now();
    const id = nanoid();

    // Validate parentId: enforce 2-level max depth
    let parentId: string | null = null;
    if (body.parentId && typeof body.parentId === "string") {
      const parent = db.select().from(folders).where(eq(folders.id, body.parentId)).get();
      if (!parent) {
        return NextResponse.json({ error: "父文件夹不存在" }, { status: 400 });
      }
      // Only root-level folders (parentId = null) can have children
      if (parent.parentId !== null) {
        return NextResponse.json({ error: "最多支持两级文件夹" }, { status: 400 });
      }
      parentId = body.parentId;
    }

    const folder = {
      id,
      parentId,
      name: (body.name as string).trim(),
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      isExpanded: true,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(folders).values(folder).run();
    return NextResponse.json(folder, { status: 201 });
  } catch (e) {
    console.error("Failed to create folder:", e);
    return NextResponse.json({ error: "创建文件夹失败" }, { status: 500 });
  }
}
