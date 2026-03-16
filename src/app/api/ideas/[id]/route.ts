import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { ideas, ideaImages, tags, ideaTags } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

function getIdeaWithRelations(db: ReturnType<typeof getDatabase>, ideaId: string) {
  const idea = db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
  if (!idea) return null;

  const ideaTagRows = db
    .select({ id: tags.id, name: tags.name })
    .from(ideaTags)
    .innerJoin(tags, eq(ideaTags.tagId, tags.id))
    .where(eq(ideaTags.ideaId, ideaId))
    .all();

  const imageRows = db
    .select()
    .from(ideaImages)
    .where(eq(ideaImages.ideaId, ideaId))
    .all();

  return {
    id: idea.id,
    content: idea.content,
    tags: ideaTagRows,
    images: imageRows.map((img) => ({
      id: img.id,
      ideaId: img.ideaId,
      url: img.cosUrl || `/api/files/${img.filePath}`,
      width: img.width,
      height: img.height,
    })),
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const existing = db.select().from(ideas).where(eq(ideas.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "想法不存在" }, { status: 404 });
    }

    const body = await request.json();
    const now = Date.now();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (typeof body.content === "string") {
      const content = body.content.trim();
      if (!content) {
        return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
      }
      updates.content = content;
    }

    db.update(ideas)
      .set(updates as { content?: string; updatedAt: number })
      .where(eq(ideas.id, id))
      .run();

    // Handle tags if provided (full replace)
    if (Array.isArray(body.tagNames)) {
      db.delete(ideaTags).where(eq(ideaTags.ideaId, id)).run();

      for (const name of body.tagNames as string[]) {
        const trimmed = name.trim();
        if (!trimmed) continue;

        const tagId = nanoid();
        db.run(sql`INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (${tagId}, ${trimmed}, ${now})`);

        const tag = db.select().from(tags).where(eq(tags.name, trimmed)).get();
        if (tag) {
          db.insert(ideaTags).values({ ideaId: id, tagId: tag.id }).run();
        }
      }
    }

    const result = getIdeaWithRelations(db, id);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Failed to update idea:", e);
    return NextResponse.json({ error: "更新想法失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const existing = db.select().from(ideas).where(eq(ideas.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "想法不存在" }, { status: 404 });
    }

    db.delete(ideas).where(eq(ideas.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete idea:", e);
    return NextResponse.json({ error: "删除想法失败" }, { status: 500 });
  }
}
