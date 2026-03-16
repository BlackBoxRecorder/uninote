import { create } from 'zustand';
import type { Value } from 'platejs';
import type { SaveStatus, Heading } from '@/types';

interface EditorState {
  // Current note
  currentNoteId: string | null;
  setCurrentNoteId: (id: string | null) => void;

  // Editor content
  initialContent: Value | null;
  setInitialContent: (content: Value | null) => void;

  // Current editing content (for manual save)
  currentContent: Value | null;
  setCurrentContent: (content: Value | null) => void;

  // Save status
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;

  // Word count
  wordCount: number;
  setWordCount: (count: number) => void;

  // Headings for outline
  headings: Heading[];
  setHeadings: (headings: Heading[]) => void;

  // Load note content (does NOT change currentNoteId)
  loadNote: (noteId: string) => Promise<void>;

  // Switch to a new note (updates currentNoteId)
  switchToNote: (noteId: string) => void;

  // Manual save
  saveCurrentNote: () => Promise<boolean>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),

  initialContent: null,
  setInitialContent: (content) => set({ initialContent: content }),

  currentContent: null,
  setCurrentContent: (content) => set({ currentContent: content }),

  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),

  wordCount: 0,
  setWordCount: (count) => set({ wordCount: count }),

  headings: [],
  setHeadings: (headings) => set({ headings }),

  loadNote: async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) return;

      const note = await res.json();
      let content: Value | null = null;

      if (note.content) {
        try {
          content = JSON.parse(note.content);
        } catch {
          // If content is not valid JSON, create a paragraph
          content = [{ type: 'p', children: [{ text: note.content }] }];
        }
      }

      set({
        initialContent: content || [{ type: 'p', children: [{ text: '' }] }],
        currentContent: null, // Reset current content when loading new note
        wordCount: note.wordCount || 0,
        saveStatus: 'saved',
      });
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  },

  switchToNote: (noteId: string) => {
    set({ currentNoteId: noteId });
  },

  saveCurrentNote: async () => {
    const { currentNoteId, currentContent } = get();
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

            // If it's a text node, return the text
            if (typeof n.text === 'string') return n.text;

            // If it has children, recurse
            if (Array.isArray(n.children)) {
              return extractText(n.children);
            }

            return '';
          })
          .join('');
      };

      const text = extractText(currentContent);
      // Count characters for Chinese (no spaces between words)
      // For mixed content, count all non-whitespace characters
      const wordCount = text.replace(/\s/g, '').length;

      const res = await fetch(`/api/notes/${currentNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, wordCount }),
      });

      if (res.ok) {
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
}));
