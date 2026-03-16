import { create } from 'zustand';
import type { Folder, NoteMeta, AppTab } from '@/types';

interface AppState {
  // Tab
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // File tree
  folders: Folder[];
  notes: NoteMeta[];
  setFolders: (folders: Folder[]) => void;
  setNotes: (notes: NoteMeta[]) => void;

  // Selection
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;

  // Search
  searchQuery: string;
  searchResults: NoteMeta[];
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: NoteMeta[]) => void;

  // Tree loading
  treeLoading: boolean;
  setTreeLoading: (loading: boolean) => void;

  // Fetch tree data
  fetchTree: () => Promise<void>;

  // Folder actions
  createFolder: (name: string, parentId?: string | null) => Promise<Folder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolder: (id: string) => Promise<void>;

  // Note actions
  createNote: (folderId: string | null, title?: string) => Promise<NoteMeta | null>;
  renameNote: (id: string, title: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'notes',
  setActiveTab: (tab) => set({ activeTab: tab }),

  folders: [],
  notes: [],
  setFolders: (folders) => set({ folders }),
  setNotes: (notes) => set({ notes }),

  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),

  searchQuery: '',
  searchResults: [],
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),

  treeLoading: false,
  setTreeLoading: (loading) => set({ treeLoading: loading }),

  fetchTree: async () => {
    set({ treeLoading: true });
    try {
      const res = await fetch('/api/tree');
      if (res.ok) {
        const data = await res.json();
        set({ folders: data.folders, notes: data.notes });
      }
    } catch (e) {
      console.error('Failed to fetch tree:', e);
    } finally {
      set({ treeLoading: false });
    }
  },

  createFolder: async (name, parentId = null) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      });
      if (res.ok) {
        const folder = await res.json();
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder;
      }
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
    return null;
  },

  renameFolder: async (id, name) => {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const updated = await res.json();
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? updated : f)),
        }));
      }
    } catch (e) {
      console.error('Failed to rename folder:', e);
    }
  },

  deleteFolder: async (id) => {
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id && f.parentId !== id),
          notes: s.notes.map((n) =>
            n.folderId === id ? { ...n, folderId: null } : n
          ),
        }));
      }
    } catch (e) {
      console.error('Failed to delete folder:', e);
    }
  },

  toggleFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    const newExpanded = !folder.isExpanded;
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isExpanded: newExpanded } : f
      ),
    }));
    fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isExpanded: newExpanded }),
    }).catch(() => {});
  },

  createNote: async (folderId, title) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, title }),
      });
      if (res.ok) {
        const note = await res.json();
        set((s) => ({ notes: [...s.notes, note] }));
        return note;
      }
    } catch (e) {
      console.error('Failed to create note:', e);
    }
    return null;
  },

  renameNote: async (id, title) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, title } : n)),
        }));
      }
    } catch (e) {
      console.error('Failed to rename note:', e);
    }
  },

  deleteNote: async (id) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const { selectedNoteId } = get();
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== id),
          selectedNoteId: selectedNoteId === id ? null : selectedNoteId,
        }));
      }
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  },
}));
