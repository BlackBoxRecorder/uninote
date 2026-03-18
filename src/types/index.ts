export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isExpanded: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NoteMeta {
  id: string;
  folderId: string | null;
  title: string;
  wordCount: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteDetail extends NoteMeta {
  content: string | null;
  markdown: string | null;
}

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export type AppTab = "notes" | "ideas" | "diary";

export interface Tag {
  id: string;
  name: string;
  count?: number;
}

export interface Idea {
  id: string;
  content: string;
  tags: Tag[];
  images: IdeaImage[];
  createdAt: number;
  updatedAt: number;
}

export interface IdeaImage {
  id: string;
  ideaId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface DiaryEntry {
  id: string;
  type: "daily" | "weekly";
  date: string;
  year: number;
  weekNumber: number;
  content: string | null;
  markdown: string | null;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export type DiaryMeta = Omit<DiaryEntry, "content" | "markdown">;
