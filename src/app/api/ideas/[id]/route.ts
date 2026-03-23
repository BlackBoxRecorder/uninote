import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { ideas, ideaImages, tags, ideaTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { withErrorHandler, ApiError } from "@/lib/api-utils";
import { getStorage } from "@/lib/storage";

// 验证标签名称
function validateTagName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "标签名称不能为空" };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: "标签名称不能超过50个字符" };
  }
  // 检查特殊字符（只允许中文、字母、数字、下划线、连字符）
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "标签名称只能包含中文、字母、数字、下划线和连字符" };
  }
  return { valid: true };
}

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

export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();

  const existing = db.select().from(ideas).where(eq(ideas.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "想法不存在");
  }

  const body = await request.json();
  const now = Date.now();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (typeof body.content === "string") {
    const content = body.content.trim();
    if (!content) {
      throw new ApiError(400, "内容不能为空");
    }
    updates.content = content;
  }

  db.update(ideas)
    .set(updates as { content?: string; updatedAt: number })
    .where(eq(ideas.id, id))
    .run();

  // Handle tags if provided (full replace)
  if (Array.isArray(body.tagNames)) {
    // 验证所有标签名称
    for (const name of body.tagNames as string[]) {
      const validation = validateTagName(name);
      if (!validation.valid) {
        throw new ApiError(400, validation.error!);
      }
    }

    db.delete(ideaTags).where(eq(ideaTags.ideaId, id)).run();

    for (const name of body.tagNames as string[]) {
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
      }
    }
  }

  const result = getIdeaWithRelations(db, id);
  return NextResponse.json(result);
});

export const DELETE = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const db = getDatabase();

  const existing = db.select().from(ideas).where(eq(ideas.id, id)).get();
  if (!existing) {
    throw new ApiError(404, "想法不存在");
  }

  // 查询所有关联的图片，用于清理本地文件
  const imageRows = db
    .select()
    .from(ideaImages)
    .where(eq(ideaImages.ideaId, id))
    .all();

  // 删除 idea 记录（关联的 ideaTags 和 ideaImages 会级联删除）
  db.delete(ideas).where(eq(ideas.id, id)).run();

  // 清理本地存储的图片文件
  for (const img of imageRows) {
    if (img.storageType === "local" && img.filePath) {
      try {
        const storage = getStorage();
        await storage.delete(img.filePath);
      } catch (err) {
        // 文件可能已经不存在，忽略错误
        console.warn(`Failed to delete image file: ${img.filePath}`, err);
      }
    }
  }

  return NextResponse.json({ success: true });
});
