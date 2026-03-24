import { create } from 'zustand';
import type { QuillDeltaData } from '@/lib/content-utils';
import { calculateWordCount } from '@/lib/content-utils';
import type { SaveStatus } from '@/types';
import {
  getCachedContent,
  setCachedContent,
  deleteCachedContent,
  evictOldEntries,
} from '@/lib/editor-cache';

type EditingType = 'note' | 'diary';

const MAX_CACHE_SIZE = 20;

/** Empty Quill document */
const EMPTY_DELTA: QuillDeltaData = { ops: [{ insert: '\n' }] };

interface CachedContent {
  content: QuillDeltaData;
  wordCount: number;
  timestamp: number;
}

interface EditorState {
  // Current note
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;

  // What type of entry is being edited
  editingType: EditingType;
  setEditingType: (type: EditingType) => void;

  // Editor content
  initialContent: QuillDeltaData | null;
  setInitialContent: (content: QuillDeltaData | null) => void;

  // Current editing content (for manual save)
  currentContent: QuillDeltaData | null;
  setCurrentContent: (content: QuillDeltaData | null) => void;

  // Markdown serializer callback (set by QuillEditor)
  markdownSerializer: (() => string) | null;
  setMarkdownSerializer: (serializer: (() => string) | null) => void;

  // HTML getter callback (set by QuillEditor)
  getEditorHTML: (() => string) | null;
  setGetEditorHTML: (getter: (() => string) | null) => void;

  // Save status
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;

  // Word count
  wordCount: number;
  setWordCount: (count: number) => void;

  // Loading state
  isLoadingContent: boolean;

  // Content cache (LRU)
  contentCache: Map<string, CachedContent>;

  // Load note content (does NOT change currentNoteId)
  loadNote: (noteId: string) => Promise<void>;

  // Load diary content (does NOT change currentNoteId)
  loadDiary: (diaryId: string) => Promise<void>;

  // Switch to a new note (updates currentNoteId)
  switchToNote: (noteId: string) => void;

  // Manual save
  saveCurrentNote: (markdown?: string) => Promise<boolean>;

  // Cache management
  invalidateCache: (id: string) => void;
}

function evictCache(cache: Map<string, CachedContent>) {
  if (cache.size <= MAX_CACHE_SIZE) return;
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

function parseContent(raw: string | null | undefined): QuillDeltaData {
  if (!raw) return EMPTY_DELTA;
  try {
    const parsed = JSON.parse(raw);
    // Validate Quill Delta format: must have ops array
    if (parsed && Array.isArray(parsed.ops)) {
      return parsed as QuillDeltaData;
    }
    // Not a valid Delta format, return empty
    console.warn('parseContent: JSON is not a valid Quill Delta, falling back to empty');
    return EMPTY_DELTA;
  } catch (e) {
    console.warn('parseContent: JSON.parse failed, falling back to empty', e);
    return EMPTY_DELTA;
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),

  editingType: 'note',
  setEditingType: (type) => set({ editingType: type }),

  initialContent: null,
  setInitialContent: (content) => set({ initialContent: content }),

  currentContent: null,
  setCurrentContent: (content) => set({ currentContent: content }),

  markdownSerializer: null,
  setMarkdownSerializer: (serializer) => set({ markdownSerializer: serializer }),

  getEditorHTML: null,
  setGetEditorHTML: (getter) => set({ getEditorHTML: getter }),

  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),

  wordCount: 0,
  setWordCount: (count) => set({ wordCount: count }),

  isLoadingContent: false,

  contentCache: new Map(),

  loadNote: async (noteId: string) => {
    const { contentCache } = get();

    // Check memory cache first (fastest)
    const memCached = contentCache.get(noteId);
    if (memCached) {
      memCached.timestamp = Date.now();
      set({
        initialContent: memCached.content,
        currentContent: null,
        wordCount: memCached.wordCount,
        saveStatus: 'saved',
      });
      return;
    }

    // Check IndexedDB cache (persisted across page refreshes)
    try {
      const idbCached = await getCachedContent(noteId);
      if (idbCached) {
        // Write to memory cache for faster subsequent access
        contentCache.set(noteId, {
          content: idbCached.content,
          wordCount: idbCached.wordCount,
          timestamp: Date.now(),
        });
        evictCache(contentCache);
        
        set({
          initialContent: idbCached.content,
          currentContent: null,
          wordCount: idbCached.wordCount,
          saveStatus: 'saved',
        });
        return;
      }
    } catch (e) {
      console.warn('Failed to read from IndexedDB cache:', e);
    }

    // Cache miss: fetch from API
    set({ isLoadingContent: true });
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) return;

      const note = await res.json();
      const content = parseContent(note.content);
      const wordCount = note.wordCount || 0;

      // Write to memory cache
      contentCache.set(noteId, { content, wordCount, timestamp: Date.now() });
      evictCache(contentCache);

      // Write to IndexedDB cache (async, don't wait)
      setCachedContent(noteId, content, wordCount)
        .then(() => evictOldEntries())
        .catch((e) => console.warn('Failed to write to IndexedDB cache:', e));

      set({
        initialContent: content,
        currentContent: null,
        wordCount,
        saveStatus: 'saved',
      });
    } catch (e) {
      console.error('Failed to load note:', e);
    } finally {
      set({ isLoadingContent: false });
    }
  },

  loadDiary: async (diaryId: string) => {
    const { contentCache } = get();

    // Check memory cache first (fastest)
    const memCached = contentCache.get(diaryId);
    if (memCached) {
      memCached.timestamp = Date.now();
      set({
        initialContent: memCached.content,
        currentContent: null,
        wordCount: memCached.wordCount,
        saveStatus: 'saved',
      });
      return;
    }

    // Check IndexedDB cache (persisted across page refreshes)
    try {
      const idbCached = await getCachedContent(diaryId);
      if (idbCached) {
        // Write to memory cache for faster subsequent access
        contentCache.set(diaryId, {
          content: idbCached.content,
          wordCount: idbCached.wordCount,
          timestamp: Date.now(),
        });
        evictCache(contentCache);
        
        set({
          initialContent: idbCached.content,
          currentContent: null,
          wordCount: idbCached.wordCount,
          saveStatus: 'saved',
        });
        return;
      }
    } catch (e) {
      console.warn('Failed to read from IndexedDB cache:', e);
    }

    // Cache miss: fetch from API
    set({ isLoadingContent: true });
    try {
      const res = await fetch(`/api/diaries/${diaryId}`);
      if (!res.ok) return;

      const diary = await res.json();
      const content = parseContent(diary.content);
      const wordCount = diary.wordCount || 0;

      // Write to memory cache
      contentCache.set(diaryId, { content, wordCount, timestamp: Date.now() });
      evictCache(contentCache);

      // Write to IndexedDB cache (async, don't wait)
      setCachedContent(diaryId, content, wordCount)
        .then(() => evictOldEntries())
        .catch((e) => console.warn('Failed to write to IndexedDB cache:', e));

      set({
        initialContent: content,
        currentContent: null,
        wordCount,
        saveStatus: 'saved',
      });
    } catch (e) {
      console.error('Failed to load diary:', e);
    } finally {
      set({ isLoadingContent: false });
    }
  },

  switchToNote: (noteId: string) => {
    set({ currentNoteId: noteId });
  },

  saveCurrentNote: async (markdown?: string) => {
    const { currentNoteId, currentContent, contentCache, markdownSerializer } = get();
    if (!currentNoteId || !currentContent) return false;

    set({ saveStatus: 'saving' });

    try {
      const content = JSON.stringify(currentContent);
      const wordCount = calculateWordCount(currentContent);

      const { editingType } = get();
      const apiPath = editingType === 'diary'
        ? `/api/diaries/${currentNoteId}`
        : `/api/notes/${currentNoteId}`;

      const body: Record<string, unknown> = { content, wordCount };

      // Generate markdown if not provided and serializer is available
      if (markdown !== undefined) {
        body.markdown = markdown;
      } else if (markdownSerializer) {
        try {
          body.markdown = markdownSerializer();
        } catch (e) {
          console.error('Failed to serialize markdown:', e);
        }
      }

      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        // Update memory cache with saved content
        contentCache.set(currentNoteId, {
          content: currentContent,
          wordCount,
          timestamp: Date.now(),
        });
        
        // Update IndexedDB cache (async, don't wait)
        setCachedContent(currentNoteId, currentContent, wordCount)
          .catch((e) => console.warn('Failed to update IndexedDB cache:', e));
        
        set({ saveStatus: 'saved', wordCount });
        return true;
      } else {
        set({ saveStatus: 'error' });
        return false;
      }
    } catch {
      set({ saveStatus: 'error' });
      return false;
    }
  },

  invalidateCache: (id: string) => {
    // Remove from memory cache
    get().contentCache.delete(id);
    // Remove from IndexedDB cache (async, don't wait)
    deleteCachedContent(id)
      .catch((e) => console.warn('Failed to delete from IndexedDB cache:', e));
  },
}));
