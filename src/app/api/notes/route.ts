import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { asc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

const TITLE_MAX = 100;
const INVALID_CHARS = /[\/\\:*?"<>|]/;

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const folderId = request.nextUrl.searchParams.get("folderId");

    let query = db
      .select({
        id: notes.id,
        folderId: notes.folderId,
        title: notes.title,
        wordCount: notes.wordCount,
        sortOrder: notes.sortOrder,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes);

    if (folderId === "root") {
      // Get root-level notes (no folder)
      query = query.where(isNull(notes.folderId)) as typeof query;
    } else if (folderId) {
      query = query.where(eq(notes.folderId, folderId)) as typeof query;
    }

    const allNotes = query.orderBy(asc(notes.sortOrder), asc(notes.createdAt)).all();
    return NextResponse.json(allNotes);
  } catch (e) {
    console.error("Failed to fetch notes:", e);
    return NextResponse.json({ error: "获取笔记列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // folderId is optional — null means root-level note
    const folderId = typeof body.folderId === "string" ? body.folderId : null;

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (title.length > TITLE_MAX) {
        return NextResponse.json({ error: `标题不能超过${TITLE_MAX}个字符` }, { status: 400 });
      }
      if (INVALID_CHARS.test(title)) {
        return NextResponse.json({ error: "标题包含非法字符" }, { status: 400 });
      }
    }

    const db = getDatabase();
    const now = Date.now();
    const id = nanoid();

    const note = {
      id,
      folderId,
      title: (typeof body.title === "string" && body.title.trim()) || "未命名笔记",
      content: null as string | null,
      markdown: null as string | null,
      wordCount: 0,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(notes).values(note).run();

    return NextResponse.json(
      { id: note.id, folderId: note.folderId, title: note.title, wordCount: 0, sortOrder: note.sortOrder, createdAt: now, updatedAt: now },
      { status: 201 }
    );
  } catch (e) {
    console.error("Failed to create note:", e);
    return NextResponse.json({ error: "创建笔记失败" }, { status: 500 });
  }
}
