import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().default("admin"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey(),
  parentId: text("parent_id").references((): any => folders.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isExpanded: integer("is_expanded", { mode: "boolean" })
    .notNull()
    .default(true),
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  folderId: text("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("Untitled"),
  content: text("content"),
  markdown: text("markdown"),
  wordCount: integer("word_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const fileAttachments = sqliteTable("file_attachments", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  storageType: text("storage_type").notNull(),
  cosUrl: text("cos_url"),
  mimeType: text("mime_type"),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const ideaImages = sqliteTable("idea_images", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  storageType: text("storage_type").notNull(),
  cosUrl: text("cos_url"),
  mimeType: text("mime_type"),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const ideaTags = sqliteTable("idea_tags", {
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const diaries = sqliteTable("diaries", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'daily' | 'weekly'
  date: text("date").notNull(), // daily: '2026-03-18', weekly: '2026-W12'
  year: integer("year").notNull(), // ISO week year
  weekNumber: integer("week_number").notNull(), // ISO week number (1-53)
  content: text("content"),
  markdown: text("markdown"),
  wordCount: integer("word_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});
