import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders, notes } from "@/db/schema";
import { asc } from "drizzle-orm";
import { withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async () => {
  const db = getDatabase();

  const allFolders = db
    .select()
    .from(folders)
    .orderBy(asc(folders.sortOrder), asc(folders.createdAt))
    .all();

  const allNotes = db
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
    .orderBy(asc(notes.sortOrder), asc(notes.createdAt))
    .all();

  return NextResponse.json({ folders: allFolders, notes: allNotes });
});
