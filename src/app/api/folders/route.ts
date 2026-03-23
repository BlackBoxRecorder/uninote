import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { withErrorHandler, ApiError, ValidationUtils } from "@/lib/api-utils";

export const GET = withErrorHandler(async () => {
  const db = getDatabase();
  const allFolders = db
    .select()
    .from(folders)
    .orderBy(asc(folders.sortOrder), asc(folders.createdAt))
    .all();
  return NextResponse.json(allFolders);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const name = ValidationUtils.validateName(body.name);

  const db = getDatabase();
  const now = Date.now();
  const id = nanoid();

  // Validate parentId: enforce 2-level max depth
  let parentId: string | null = null;
  if (body.parentId && typeof body.parentId === "string") {
    const parent = db.select().from(folders).where(eq(folders.id, body.parentId)).get();
    if (!parent) {
      throw new ApiError(400, "父文件夹不存在");
    }
    // Only root-level folders (parentId = null) can have children
    if (parent.parentId !== null) {
      throw new ApiError(400, "最多支持两级文件夹");
    }
    parentId = body.parentId;
  }

  const folder = {
    id,
    parentId,
    name,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    isExpanded: true,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(folders).values(folder).run();
  return NextResponse.json(folder, { status: 201 });
});
