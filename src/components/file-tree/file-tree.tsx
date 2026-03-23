"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { FolderItem } from "./folder-item";
import { NoteItem } from "./note-item";
import {
  FolderPlus,
  FilePlus,
  Search,
  X,
  FileText,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Archive,
} from "lucide-react";
import type { NoteMeta } from "@/types";
import { cn } from "@/lib/utils";

export function FileTree() {
  const folders = useAppStore((s) => s.folders);
  const notes = useAppStore((s) => s.notes);
  const createFolder = useAppStore((s) => s.createFolder);
  const createNote = useAppStore((s) => s.createNote);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const expandAllFolders = useAppStore((s) => s.expandAllFolders);
  const collapseAllFolders = useAppStore((s) => s.collapseAllFolders);
  const loadNote = useEditorStore((s) => s.loadNote);
  const switchToNote = useEditorStore((s) => s.switchToNote);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveCurrentNote = useEditorStore((s) => s.saveCurrentNote);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<NoteMeta[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  // Root-level folders (no parent, not archived)
  const rootFolders = folders.filter((f) => f.parentId === null && !f.isArchived);
  // Root-level notes (no folder)
  const rootNotes = notes.filter((n) => n.folderId === null);
  // Archived folders
  const archivedFolders = folders.filter((f) => f.isArchived);

  // Check if all non-archived folders are expanded or collapsed
  const activeFolders = folders.filter((f) => !f.isArchived);
  const allExpanded = activeFolders.length > 0 && activeFolders.every((f) => f.isExpanded);
  const allCollapsed = activeFolders.length === 0 || activeFolders.every((f) => !f.isExpanded);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setCreatingFolder(false);
      return;
    }
    await createFolder(newFolderName.trim());
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const handleCreateRootNote = async () => {
    // 如果当前有未保存的内容，先自动保存
    if (saveStatus === "unsaved") {
      await saveCurrentNote();
    }

    const note = await createNote(null, "未命名笔记");
    if (note) {
      await loadNote(note.id);
      switchToNote(note.id);
      setSelectedNoteId(note.id);
    }
  };

  const handleToggleAllFolders = () => {
    if (allExpanded) {
      collapseAllFolders();
    } else {
      expandAllFolders();
    }
  };

  // Search notes
  const searchNotes = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/notes/search?q=${encodeURIComponent(keyword.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.notes || []);
        setShowSearchResults(true);
      }
    } catch (e) {
      console.error("搜索失败:", e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchKeyword.trim()) {
        searchNotes(searchKeyword);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchKeyword, searchNotes]);

  const clearSearch = () => {
    setSearchKeyword("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[41px] items-center justify-between border-b border-border px-5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">文件</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleAllFolders}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            title={allExpanded ? "折叠所有文件夹" : "展开所有文件夹"}
            disabled={folders.length === 0}
          >
            {allExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : allCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleCreateRootNote}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="新建根级笔记"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCreatingFolder(true)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="新建文件夹"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search Box */}
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索笔记..."
            className="w-full rounded border border-input bg-background pl-7 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchKeyword && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {showSearchResults ? (
          <div>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {isSearching ? "搜索中..." : `找到 ${searchResults.length} 个结果`}
            </div>
            {searchResults.map((note) => (
              <SearchResultItem key={note.id} note={note} />
            ))}
            {searchResults.length === 0 && !isSearching && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                未找到匹配的笔记
              </div>
            )}
          </div>
        ) : (
          <>
            {creatingFolder && (
              <div className="px-2 py-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  onBlur={handleCreateFolder}
                  autoFocus
                  placeholder="文件夹名称"
                  className="w-full rounded border border-brand bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            )}

            {/* Root folders */}
            {rootFolders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                notes={notes.filter((n) => n.folderId === folder.id)}
                childFolders={folders.filter((f) => f.parentId === folder.id && !f.isArchived)}
                allNotes={notes}
                allFolders={folders}
              />
            ))}

            {/* Root notes (no folder) */}
            {rootNotes.length > 0 && (
              <div className="mt-1">
                {rootFolders.length > 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">根级笔记</div>
                )}
                {rootNotes.map((note) => (
                  <NoteItem key={note.id} note={note} depth={0} />
                ))}
              </div>
            )}

            {/* Archived folders section */}
            {archivedFolders.length > 0 && (
              <div className="mt-2 border-t border-border pt-1">
                <button
                  onClick={() => setArchiveExpanded(!archiveExpanded)}
                  className="group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                >
                  {archiveExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <Archive className="h-4 w-4 flex-shrink-0" />
                  <span>已归档</span>
                  <span className="ml-auto text-xs opacity-0 group-hover:opacity-100">
                    {archivedFolders.length}
                  </span>
                </button>
                {archiveExpanded && (
                  <div>
                    {archivedFolders.map((folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        notes={notes.filter((n) => n.folderId === folder.id)}
                        childFolders={folders.filter((f) => f.parentId === folder.id && !f.isArchived)}
                        allNotes={notes}
                        allFolders={folders}
                        depth={1}
                        isInArchive
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {rootFolders.length === 0 && rootNotes.length === 0 && archivedFolders.length === 0 && !creatingFolder && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                <p>暂无内容</p>
                <p className="mt-1">点击上方按钮创建文件夹或笔记</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResultItem({ note }: { note: NoteMeta }) {
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const loadNote = useEditorStore((s) => s.loadNote);
  const isActive = selectedNoteId === note.id;

  return (
    <button
      onClick={() => {
        setSelectedNoteId(note.id);
        loadNote(note.id);
      }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{note.title}</span>
    </button>
  );
}
