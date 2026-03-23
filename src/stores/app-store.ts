import { create } from 'zustand';
import type { Folder, NoteMeta, AppTab } from '@/types';
import type { TreeResponse, ErrorResponse } from '@/types/api';
import { useEditorStore } from './editor-store';
import { useDiaryStore } from './diary-store';
import { getTodayStr } from '@/lib/diary-utils';

// 解析 API 错误响应
async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const data: ErrorResponse = await res.json();
    return data.error || '请求失败';
  } catch {
    return '请求失败';
  }
}

interface AppState {
  // Tab
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => Promise<void>;

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

  // Error state
  error: string | null;
  clearError: () => void;

  // Fetch tree data
  fetchTree: () => Promise<void>;

  // Folder actions
  createFolder: (name: string, parentId?: string | null) => Promise<Folder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolder: (id: string) => Promise<void>;
  expandAllFolders: () => Promise<void>;
  collapseAllFolders: () => Promise<void>;
  archiveFolder: (id: string) => Promise<void>;
  unarchiveFolder: (id: string) => Promise<void>;

  // Note actions
  createNote: (folderId: string | null, title?: string) => Promise<NoteMeta | null>;
  renameNote: (id: string, title: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'diary',
  setActiveTab: async (tab) => {
    const prevTab = get().activeTab;
    if (prevTab === tab) return;

    // Save current content before switching (await to prevent race condition)
    const editorStore = useEditorStore.getState();
    if (editorStore.saveStatus === 'unsaved' && editorStore.currentNoteId) {
      await editorStore.saveCurrentNote();
    }

    set({ activeTab: tab });

    // Load content for the new tab
    if (tab === 'diary') {
      // Switch to diary: open today's diary
      const diaryStore = useDiaryStore.getState();
      const today = getTodayStr();
      diaryStore.openDiary('daily', today);
    } else if (tab === 'notes') {
      // Switch to notes: load previously selected note or first root note
      const { selectedNoteId, notes, folders } = get();
      const editorStore = useEditorStore.getState();

      if (selectedNoteId) {
        // Load previously selected note
        editorStore.setEditingType('note');
        editorStore.loadNote(selectedNoteId);
        editorStore.switchToNote(selectedNoteId);
      } else {
        // Find first root note (no folder)
        const rootNotes = notes.filter((n) => n.folderId === null);
        if (rootNotes.length > 0) {
          const firstNote = rootNotes[0];
          set({ selectedNoteId: firstNote.id });
          editorStore.setEditingType('note');
          editorStore.loadNote(firstNote.id);
          editorStore.switchToNote(firstNote.id);
        } else {
          // Find first note in first non-archived folder
          const rootFolders = folders.filter((f) => f.parentId === null && !f.isArchived);
          for (const folder of rootFolders) {
            const folderNotes = notes.filter((n) => n.folderId === folder.id);
            if (folderNotes.length > 0) {
              const firstNote = folderNotes[0];
              set({ selectedNoteId: firstNote.id });
              editorStore.setEditingType('note');
              editorStore.loadNote(firstNote.id);
              editorStore.switchToNote(firstNote.id);
              break;
            }
          }
        }
      }
    }
  },

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

  error: null,
  clearError: () => set({ error: null }),

  fetchTree: async () => {
    set({ treeLoading: true });
    try {
      const res = await fetch('/api/tree');
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const data: TreeResponse = await res.json();
      set({ folders: data.folders, notes: data.notes, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '获取文件树失败';
      console.error('Failed to fetch tree:', message);
      set({ error: message });
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
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const folder: Folder = await res.json();
      set((s) => ({ folders: [...s.folders, folder], error: null }));
      return folder;
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建文件夹失败';
      console.error('Failed to create folder:', message);
      set({ error: message });
      return null;
    }
  },

  renameFolder: async (id, name) => {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const updated: Folder = await res.json();
      set((s) => ({
        folders: s.folders.map((f) => (f.id === id ? updated : f)),
        error: null,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '重命名文件夹失败';
      console.error('Failed to rename folder:', message);
      set({ error: message });
    }
  },

  deleteFolder: async (id) => {
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      // Refresh tree from server to correctly handle cascade deletion
      // of nested subfolders and note reassignment
      await get().fetchTree();
      set({ error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除文件夹失败';
      console.error('Failed to delete folder:', message);
      set({ error: message });
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

  expandAllFolders: async () => {
    const { folders } = get();
    const collapsedFolders = folders.filter((f) => !f.isExpanded && !f.isArchived);
    if (collapsedFolders.length === 0) return;

    // Optimistically update UI (only non-archived folders)
    set((s) => ({
      folders: s.folders.map((f) => f.isArchived ? f : { ...f, isExpanded: true }),
    }));

    // Batch update all collapsed folders
    await Promise.all(
      collapsedFolders.map((folder) =>
        fetch(`/api/folders/${folder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExpanded: true }),
        }).catch(() => {})
      )
    );
  },

  collapseAllFolders: async () => {
    const { folders } = get();
    const expandedFolders = folders.filter((f) => f.isExpanded && !f.isArchived);
    if (expandedFolders.length === 0) return;

    // Optimistically update UI (only non-archived folders)
    set((s) => ({
      folders: s.folders.map((f) => f.isArchived ? f : { ...f, isExpanded: false }),
    }));

    // Batch update all expanded folders
    await Promise.all(
      expandedFolders.map((folder) =>
        fetch(`/api/folders/${folder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExpanded: false }),
        }).catch(() => {})
      )
    );
  },

  archiveFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder || folder.isArchived) return;

    // Optimistically update UI
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isArchived: true } : f
      ),
    }));

    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!res.ok) {
        // Rollback on failure
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id ? { ...f, isArchived: false } : f
          ),
        }));
      }
    } catch {
      // Rollback on error
      set((s) => ({
        folders: s.folders.map((f) =>
          f.id === id ? { ...f, isArchived: false } : f
        ),
      }));
    }
  },

  unarchiveFolder: async (id) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder || !folder.isArchived) return;

    // Optimistically update UI
    set((s) => ({
      folders: s.folders.map((f) =>
        f.id === id ? { ...f, isArchived: false } : f
      ),
    }));

    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) {
        // Rollback on failure
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === id ? { ...f, isArchived: true } : f
          ),
        }));
      }
    } catch {
      // Rollback on error
      set((s) => ({
        folders: s.folders.map((f) =>
          f.id === id ? { ...f, isArchived: true } : f
        ),
      }));
    }
  },

  createNote: async (folderId, title) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, title }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const note: NoteMeta = await res.json();
      set((s) => ({ notes: [...s.notes, note], error: null }));
      return note;
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建笔记失败';
      console.error('Failed to create note:', message);
      set({ error: message });
      return null;
    }
  },

  renameNote: async (id, title) => {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? { ...n, title } : n)),
        error: null,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '重命名笔记失败';
      console.error('Failed to rename note:', message);
      set({ error: message });
    }
  },

  deleteNote: async (id) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const { selectedNoteId } = get();
      set((s) => ({
        notes: s.notes.filter((n) => n.id !== id),
        selectedNoteId: selectedNoteId === id ? null : selectedNoteId,
        error: null,
      }));
      // Clear from editor content cache
      useEditorStore.getState().invalidateCache(id);
      if (selectedNoteId === id) {
        useEditorStore.getState().setCurrentNoteId(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除笔记失败';
      console.error('Failed to delete note:', message);
      set({ error: message });
    }
  },
}));
