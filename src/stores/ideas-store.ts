import { create } from 'zustand';
import type { Idea, Tag } from '@/types';

interface IdeasState {
  ideas: Idea[];
  tags: Tag[];
  selectedTagId: string | null;
  hasMore: boolean;
  loading: boolean;

  setSelectedTagId: (id: string | null) => void;

  fetchIdeas: (reset?: boolean) => Promise<void>;
  fetchTags: () => Promise<void>;
  createIdea: (content: string, tagNames: string[], imageIds: string[]) => Promise<Idea | null>;
  updateIdea: (id: string, content: string, tagNames: string[]) => Promise<Idea | null>;
  deleteIdea: (id: string) => Promise<void>;
}

export const useIdeasStore = create<IdeasState>((set, get) => ({
  ideas: [],
  tags: [],
  selectedTagId: null,
  hasMore: true,
  loading: false,

  setSelectedTagId: (id) => set({ selectedTagId: id }),

  fetchIdeas: async (reset = false) => {
    const { ideas, selectedTagId, loading } = get();
    if (loading) return;

    set({ loading: true });

    try {
      const params = new URLSearchParams();
      if (selectedTagId) params.set('tagId', selectedTagId);
      if (!reset && ideas.length > 0) {
        params.set('cursor', String(ideas[ideas.length - 1].createdAt));
      }

      const res = await fetch(`/api/ideas?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          set({ ideas: data.ideas, hasMore: data.hasMore });
        } else {
          set((s) => ({
            ideas: [...s.ideas, ...data.ideas],
            hasMore: data.hasMore,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to fetch ideas:', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchTags: async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        set({ tags: data.tags });
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
    }
  },

  createIdea: async (content, tagNames, imageIds) => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tagNames, imageIds }),
      });
      if (res.ok) {
        const idea: Idea = await res.json();
        set((s) => ({ ideas: [idea, ...s.ideas] }));
        // Refresh tags to update counts
        get().fetchTags();
        return idea;
      }
    } catch (e) {
      console.error('Failed to create idea:', e);
    }
    return null;
  },

  updateIdea: async (id, content, tagNames) => {
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tagNames }),
      });
      if (res.ok) {
        const updated: Idea = await res.json();
        set((s) => ({
          ideas: s.ideas.map((i) => (i.id === id ? updated : i)),
        }));
        get().fetchTags();
        return updated;
      }
    } catch (e) {
      console.error('Failed to update idea:', e);
    }
    return null;
  },

  deleteIdea: async (id) => {
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
        get().fetchTags();
      }
    } catch (e) {
      console.error('Failed to delete idea:', e);
    }
  },
}));
