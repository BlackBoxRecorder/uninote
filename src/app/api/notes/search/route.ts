import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { like, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("q");

    if (!keyword || keyword.trim() === "") {
      return NextResponse.json({ notes: [] });
    }

    const db = getDatabase();
    const searchPattern = `%${keyword.trim()}%`;

    const searchResults = db
      .select({
        id: notes.id,
        folderId: notes.folderId,
        title: notes.title,
        wordCount: notes.wordCount,
        sortOrder: notes.sortOrder,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        or(
          like(notes.title, searchPattern),
          like(notes.content, searchPattern),
          like(notes.markdown, searchPattern)
        )
      )
      .all();

    return NextResponse.json({ notes: searchResults });
  } catch (e) {
    console.error("Failed to search notes:", e);
    return NextResponse.json({ error: "搜索笔记失败" }, { status: 500 });
  }
}
