import { create } from 'zustand';
import type { Idea, Tag } from '@/types';
import type { IdeasListResponse, TagsListResponse, ErrorResponse } from '@/types/api';

// 解析 API 错误响应
async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const data: ErrorResponse = await res.json();
    return data.error || '请求失败';
  } catch {
    return '请求失败';
  }
}

interface IdeasState {
  ideas: Idea[];
  tags: Tag[];
  selectedTagId: string | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;

  setSelectedTagId: (id: string | null) => void;
  clearError: () => void;

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
  error: null,

  setSelectedTagId: (id) => set({ selectedTagId: id }),
  clearError: () => set({ error: null }),

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
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const data: IdeasListResponse = await res.json();
      if (reset) {
        set({ ideas: data.ideas, hasMore: data.hasMore, error: null });
      } else {
        set((s) => ({
          ideas: [...s.ideas, ...data.ideas],
          hasMore: data.hasMore,
          error: null,
        }));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '获取想法列表失败';
      console.error('Failed to fetch ideas:', message);
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  fetchTags: async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const data: TagsListResponse = await res.json();
      set({ tags: data.tags, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '获取标签失败';
      console.error('Failed to fetch tags:', message);
      set({ error: message });
    }
  },

  createIdea: async (content, tagNames, imageIds) => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tagNames, imageIds }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const idea: Idea = await res.json();
      set((s) => ({ ideas: [idea, ...s.ideas], error: null }));
      // Refresh tags to update counts
      get().fetchTags();
      return idea;
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建想法失败';
      console.error('Failed to create idea:', message);
      set({ error: message });
      return null;
    }
  },

  updateIdea: async (id, content, tagNames) => {
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tagNames }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const updated: Idea = await res.json();
      set((s) => ({
        ideas: s.ideas.map((i) => (i.id === id ? updated : i)),
        error: null,
      }));
      get().fetchTags();
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : '更新想法失败';
      console.error('Failed to update idea:', message);
      set({ error: message });
      return null;
    }
  },

  deleteIdea: async (id) => {
    // 保存原始状态用于回滚
    const originalIdeas = get().ideas;
    
    // 乐观更新
    set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
    
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      set({ error: null });
      get().fetchTags();
    } catch (e) {
      // 回滚
      set({ ideas: originalIdeas });
      const message = e instanceof Error ? e.message : '删除想法失败';
      console.error('Failed to delete idea:', message);
      set({ error: message });
    }
  },
}));
