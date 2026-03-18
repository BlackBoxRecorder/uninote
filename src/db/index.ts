import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { hashSync } from "bcryptjs";

const DB_PATH = process.env.DATABASE_PATH || "./data/ynote.db";

function getDb() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  initializeDatabase(sqlite);

  return db;
}

function initializeDatabase(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT 'admin',
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_expanded INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT,
      markdown TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      cos_url TEXT,
      mime_type TEXT,
      size INTEGER,
      width INTEGER,
      height INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_file_attachments_note_id ON file_attachments(note_id);

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idea_images (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      cos_url TEXT,
      mime_type TEXT,
      size INTEGER,
      width INTEGER,
      height INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idea_tags (
      idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (idea_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_idea_images_idea_id ON idea_images(idea_id);
    CREATE INDEX IF NOT EXISTS idx_idea_tags_idea_id ON idea_tags(idea_id);
    CREATE INDEX IF NOT EXISTS idx_idea_tags_tag_id ON idea_tags(tag_id);

    CREATE TABLE IF NOT EXISTS diaries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      content TEXT,
      markdown TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_diaries_type_date ON diaries(type, date);
    CREATE INDEX IF NOT EXISTS idx_diaries_year ON diaries(year);
    CREATE INDEX IF NOT EXISTS idx_diaries_year_week ON diaries(year, week_number);
  `);

  // Migration: add is_archived column to existing folders table
  const cols = sqlite
    .prepare("PRAGMA table_info(folders)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_archived")) {
    sqlite.exec(
      "ALTER TABLE folders ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0"
    );
  }

  // Initialize admin user if not exists
  const authKey = process.env.AUTH_SECRET_KEY;
  if (authKey) {
    const existing = sqlite
      .prepare("SELECT id FROM users WHERE id = 'admin'")
      .get();
    if (!existing) {
      const now = Date.now();
      const hash = hashSync(authKey, 10);
      sqlite
        .prepare(
          "INSERT INTO users (id, password_hash, created_at, updated_at) VALUES ('admin', ?, ?, ?)"
        )
        .run(hash, now, now);
    }
  }
}

// Singleton pattern for database connection
let dbInstance: ReturnType<typeof getDb> | null = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = getDb();
  }
  return dbInstance;
}

export type DbType = ReturnType<typeof getDatabase>;
