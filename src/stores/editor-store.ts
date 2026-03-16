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

  // Save status
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;

  // Word count
  wordCount: number;
  setWordCount: (count: number) => void;

  // Headings for outline
  headings: Heading[];
  setHeadings: (headings: Heading[]) => void;

  // Load note content
  loadNote: (noteId: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentNoteId: null,
  setCurrentNoteId: (id) => set({ currentNoteId: id }),

  initialContent: null,
  setInitialContent: (content) => set({ initialContent: content }),

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
        currentNoteId: noteId,
        initialContent: content || [{ type: 'p', children: [{ text: '' }] }],
        wordCount: note.wordCount || 0,
        saveStatus: 'saved',
      });
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  },
}));
