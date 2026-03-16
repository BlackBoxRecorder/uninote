import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { tags, ideaTags } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";

export async function GET() {
  try {
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
  } catch (e) {
    console.error("Failed to fetch tags:", e);
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
  }
}
