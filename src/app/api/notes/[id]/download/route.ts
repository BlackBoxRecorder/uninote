import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    const markdown = note.markdown || `# ${note.title}\n`;
    const fileName = `${note.title.replace(/[\/\\:*?"<>|]/g, "_")}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    console.error("Failed to download note:", e);
    return NextResponse.json({ error: "下载失败" }, { status: 500 });
  }
}
