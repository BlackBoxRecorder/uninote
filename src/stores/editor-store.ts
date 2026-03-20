import { create } from 'zustand';
import type { Value } from 'platejs';
import type { SaveStatus } from '@/types';

type EditingType = 'note' | 'diary';

const MAX_CACHE_SIZE = 20;

interface CachedContent {
  content: Value;
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
  initialContent: Value | null;
  setInitialContent: (content: Value | null) => void;

  // Current editing content (for manual save)
  currentContent: Value | null;
  setCurrentContent: (content: Value | null) => void;

  // Markdown serializer callback (set by PlateEditor)
  markdownSerializer: ((value: Value) => string) | null;
  setMarkdownSerializer: (serializer: ((value: Value) => string) | null) => void;

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

function parseContent(raw: string | null | undefined): Value {
  if (!raw) return [{ type: 'p', children: [{ text: '' }] }];
  try {
    return JSON.parse(raw);
  } catch {
    return [{ type: 'p', children: [{ text: raw }] }];
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

  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),

  wordCount: 0,
  setWordCount: (count) => set({ wordCount: count }),

  isLoadingContent: false,

  contentCache: new Map(),

  loadNote: async (noteId: string) => {
    const { contentCache } = get();

    // Check cache first
    const cached = contentCache.get(noteId);
    if (cached) {
      cached.timestamp = Date.now();
      set({
        initialContent: cached.content,
        currentContent: null,
        wordCount: cached.wordCount,
        saveStatus: 'saved',
      });
      return;
    }

    // Cache miss: fetch from API
    set({ isLoadingContent: true });
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) return;

      const note = await res.json();
      const content = parseContent(note.content);
      const wordCount = note.wordCount || 0;

      // Write to cache
      contentCache.set(noteId, { content, wordCount, timestamp: Date.now() });
      evictCache(contentCache);

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

    // Check cache first
    const cached = contentCache.get(diaryId);
    if (cached) {
      cached.timestamp = Date.now();
      set({
        initialContent: cached.content,
        currentContent: null,
        wordCount: cached.wordCount,
        saveStatus: 'saved',
      });
      return;
    }

    // Cache miss: fetch from API
    set({ isLoadingContent: true });
    try {
      const res = await fetch(`/api/diaries/${diaryId}`);
      if (!res.ok) return;

      const diary = await res.json();
      const content = parseContent(diary.content);
      const wordCount = diary.wordCount || 0;

      // Write to cache
      contentCache.set(diaryId, { content, wordCount, timestamp: Date.now() });
      evictCache(contentCache);

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

      // Recursively extract all text from nested nodes
      const extractText = (nodes: unknown[]): string => {
        return nodes
          .map((node) => {
            if (!node || typeof node !== 'object') return '';
            const n = node as Record<string, unknown>;

            if (typeof n.text === 'string') return n.text;

            if (Array.isArray(n.children)) {
              return extractText(n.children);
            }

            return '';
          })
          .join('');
      };

      const text = extractText(currentContent);
      const wordCount = text.replace(/\s/g, '').length;

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
          body.markdown = markdownSerializer(currentContent);
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
        // Update cache with saved content
        contentCache.set(currentNoteId, {
          content: currentContent,
          wordCount,
          timestamp: Date.now(),
        });
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
    get().contentCache.delete(id);
  },
}));
