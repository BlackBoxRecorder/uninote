import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { ideas, ideaImages, tags, ideaTags } from "@/db/schema";
import { desc, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const params = request.nextUrl.searchParams;
    const tagId = params.get("tagId");
    const cursor = params.get("cursor");
    const limit = Math.min(Number(params.get("limit")) || 20, 50);

    let ideaRows: { id: string; content: string; createdAt: number; updatedAt: number }[];

    if (tagId) {
      const filtered = db
        .select({
          id: ideas.id,
          content: ideas.content,
          createdAt: ideas.createdAt,
          updatedAt: ideas.updatedAt,
        })
        .from(ideas)
        .innerJoin(ideaTags, eq(ideas.id, ideaTags.ideaId))
        .where(
          cursor
            ? sql`${ideaTags.tagId} = ${tagId} AND ${ideas.createdAt} < ${Number(cursor)}`
            : eq(ideaTags.tagId, tagId)
        )
        .orderBy(desc(ideas.createdAt))
        .limit(limit + 1)
        .all();
      ideaRows = filtered;
    } else {
      const conditions = cursor ? lt(ideas.createdAt, Number(cursor)) : undefined;
      const query = conditions
        ? db.select().from(ideas).where(conditions)
        : db.select().from(ideas);
      ideaRows = query.orderBy(desc(ideas.createdAt)).limit(limit + 1).all();
    }

    const hasMore = ideaRows.length > limit;
    if (hasMore) ideaRows = ideaRows.slice(0, limit);

    const result = ideaRows.map((idea) => {
      const ideaTagRows = db
        .select({ id: tags.id, name: tags.name })
        .from(ideaTags)
        .innerJoin(tags, eq(ideaTags.tagId, tags.id))
        .where(eq(ideaTags.ideaId, idea.id))
        .all();

      const imageRows = db
        .select()
        .from(ideaImages)
        .where(eq(ideaImages.ideaId, idea.id))
        .all();

      const images = imageRows.map((img) => ({
        id: img.id,
        ideaId: img.ideaId,
        url: img.cosUrl || `/api/files/${img.filePath}`,
        width: img.width,
        height: img.height,
      }));

      return {
        id: idea.id,
        content: idea.content,
        tags: ideaTagRows,
        images,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
      };
    });

    return NextResponse.json({ ideas: result, hasMore });
  } catch (e) {
    console.error("Failed to fetch ideas:", e);
    return NextResponse.json({ error: "获取想法列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const imageIds: string[] = Array.isArray(body.imageIds) ? body.imageIds : [];

    if (!content && imageIds.length === 0) {
      return NextResponse.json({ error: "内容和图片不能同时为空" }, { status: 400 });
    }

    const db = getDatabase();
    const now = Date.now();
    const id = nanoid();

    db.insert(ideas).values({ id, content, createdAt: now, updatedAt: now }).run();

    const tagNames: string[] = Array.isArray(body.tagNames) ? body.tagNames : [];
    const resolvedTags: { id: string; name: string }[] = [];

    for (const name of tagNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      const tagId = nanoid();
      db.run(sql`INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (${tagId}, ${trimmed}, ${now})`);

      const tag = db.select().from(tags).where(eq(tags.name, trimmed)).get();
      if (tag) {
        db.insert(ideaTags).values({ ideaId: id, tagId: tag.id }).run();
        resolvedTags.push({ id: tag.id, name: tag.name });
      }
    }

    const resultImages: { id: string; ideaId: string; url: string; width: number | null; height: number | null }[] = [];

    for (const imgId of imageIds) {
      db.update(ideaImages).set({ ideaId: id }).where(eq(ideaImages.id, imgId)).run();
      const img = db.select().from(ideaImages).where(eq(ideaImages.id, imgId)).get();
      if (img) {
        resultImages.push({
          id: img.id,
          ideaId: id,
          url: img.cosUrl || `/api/files/${img.filePath}`,
          width: img.width,
          height: img.height,
        });
      }
    }

    return NextResponse.json(
      {
        id,
        content,
        tags: resolvedTags,
        images: resultImages,
        createdAt: now,
        updatedAt: now,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Failed to create idea:", e);
    return NextResponse.json({ error: "创建想法失败" }, { status: 500 });
  }
}
