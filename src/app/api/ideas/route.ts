import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { ideas, ideaImages, tags, ideaTags } from "@/db/schema";
import { desc, eq, lt, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
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

  // 批量查询优化：避免 N+1 查询
  const ideaIds = ideaRows.map((idea) => idea.id);

  // 批量查询所有关联的 tags
  const allIdeaTags = ideaIds.length > 0
    ? db
        .select({
          ideaId: ideaTags.ideaId,
          tagId: tags.id,
          tagName: tags.name,
        })
        .from(ideaTags)
        .innerJoin(tags, eq(ideaTags.tagId, tags.id))
        .where(inArray(ideaTags.ideaId, ideaIds))
        .all()
    : [];

  // 批量查询所有关联的 images
  const allImages = ideaIds.length > 0
    ? db.select().from(ideaImages).where(inArray(ideaImages.ideaId, ideaIds)).all()
    : [];

  // 在内存中用 Map 组装关系
  const tagsByIdeaId = new Map<string, { id: string; name: string }[]>();
  for (const row of allIdeaTags) {
    if (!tagsByIdeaId.has(row.ideaId)) {
      tagsByIdeaId.set(row.ideaId, []);
    }
    tagsByIdeaId.get(row.ideaId)!.push({ id: row.tagId, name: row.tagName });
  }

  const imagesByIdeaId = new Map<string, typeof allImages>();
  for (const img of allImages) {
    const imgIdeaId = img.ideaId;
    if (imgIdeaId) {
      if (!imagesByIdeaId.has(imgIdeaId)) {
        imagesByIdeaId.set(imgIdeaId, []);
      }
      imagesByIdeaId.get(imgIdeaId)!.push(img);
    }
  }

  const result = ideaRows.map((idea) => {
    const ideaTags = tagsByIdeaId.get(idea.id) || [];
    const imageRows = imagesByIdeaId.get(idea.id) || [];

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
      tags: ideaTags,
      images,
      createdAt: idea.createdAt,
      updatedAt: idea.updatedAt,
    };
  });

  return NextResponse.json({ ideas: result, hasMore });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageIds: string[] = Array.isArray(body.imageIds) ? body.imageIds : [];

  if (!content && imageIds.length === 0) {
    throw new ApiError(400, "内容和图片不能同时为空");
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

    // 先查询 tag 是否存在
    let tag = db.select().from(tags).where(eq(tags.name, trimmed)).get();
    if (!tag) {
      // 不存在则创建新 tag
      try {
        const tagId = nanoid();
        db.insert(tags).values({ id: tagId, name: trimmed, createdAt: now }).run();
        tag = { id: tagId, name: trimmed, createdAt: now };
      } catch {
        // 并发插入导致唯一约束冲突，回退查询
        tag = db.select().from(tags).where(eq(tags.name, trimmed)).get();
      }
    }

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
});
