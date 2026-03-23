import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { tags, ideaTags } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async () => {
  const db = getDatabase();

  const result = db
    .select({
      id: tags.id,
      name: tags.name,
      count: sql<number>`count(${ideaTags.ideaId})`.as("count"),
    })
    .from(tags)
    .leftJoin(ideaTags, eq(tags.id, ideaTags.tagId))
    .groupBy(tags.id)
    .orderBy(desc(sql`count`))
    .all();

  return NextResponse.json({ tags: result });
});
