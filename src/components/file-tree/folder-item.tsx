"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { NoteItem } from "./note-item";
import { ChevronRight, ChevronDown, Folder, FolderPlus, FilePlus } from "lucide-react";
import type { Folder as FolderType, NoteMeta } from "@/types";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface FolderItemProps {
  folder: FolderType;
  notes: NoteMeta[];
  childFolders: FolderType[];
  allNotes: NoteMeta[];
  allFolders: FolderType[];
  depth?: number;
}

export function FolderItem({ folder, notes, childFolders, allNotes, allFolders, depth = 0 }: FolderItemProps) {
  const toggleFolder = useAppStore((s) => s.toggleFolder);
  const renameFolder = useAppStore((s) => s.renameFolder);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const createNote = useAppStore((s) => s.createNote);
  const createFolder = useAppStore((s) => s.createFolder);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const loadNote = useEditorStore((s) => s.loadNote);
  const switchToNote = useEditorStore((s) => s.switchToNote);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveCurrentNote = useEditorStore((s) => s.saveCurrentNote);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [creatingNote, setCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const isRootFolder = folder.parentId === null;

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== folder.name) {
      await renameFolder(folder.id, trimmed);
    }
    setRenaming(false);
  };

  const handleCreateNote = async () => {
    if (!newNoteName.trim()) {
      setCreatingNote(false);
      setNewNoteName("");
      return;
    }

    // 如果当前有未保存的内容，先自动保存
    if (saveStatus === "unsaved") {
      await saveCurrentNote();
    }

    const note = await createNote(folder.id, newNoteName.trim());
    if (note) {
      await loadNote(note.id);
      switchToNote(note.id);
      setSelectedNoteId(note.id);
    }
    setNewNoteName("");
    setCreatingNote(false);
  };

  const handleCreateSubfolder = async () => {
    if (!newSubfolderName.trim()) {
      setCreatingSubfolder(false);
      setNewSubfolderName("");
      return;
    }
    await createFolder(newSubfolderName.trim(), folder.id);
    setNewSubfolderName("");
    setCreatingSubfolder(false);
  };

  const handleDelete = async () => {
    await deleteFolder(folder.id);
  };

  const getDeleteDescription = () => {
    const totalNotes = notes.length;
    const totalSubfolders = childFolders.length;
    if (totalNotes > 0 || totalSubfolders > 0) {
      return `文件夹 "${folder.name}" 包含 ${totalSubfolders > 0 ? `${totalSubfolders} 个子文件夹和 ` : ''}${totalNotes} 个笔记，删除后笔记将变为根级笔记。确定删除吗？`;
    }
    return `确定删除文件夹 "${folder.name}" 吗？`;
  };

  const totalItems = notes.length + childFolders.length;

  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            onClick={() => toggleFolder(folder.id)}
            className={cn(
              "group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors",
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {folder.isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <Folder className="h-4 w-4 text-brand/70 flex-shrink-0" />
            {renaming ? (
              <input
                ref={renameRef}
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setRenaming(false);
                    setRenameName(folder.name);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onBlur={handleRename}
                className="flex-1 rounded border border-brand bg-background px-1 py-0 text-sm text-foreground focus:outline-none min-w-0"
              />
            ) : (
              <span className="truncate">{folder.name}</span>
            )}
            <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
              {totalItems}
            </span>
          </button>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content className="min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-xl z-50">
            <ContextMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-popover-foreground outline-none hover:bg-accent transition-colors"
              onSelect={() => {
                setCreatingNote(true);
                if (!folder.isExpanded) toggleFolder(folder.id);
              }}
            >
              <FilePlus className="h-3.5 w-3.5" />
              新建笔记
            </ContextMenu.Item>
            {isRootFolder && (
              <ContextMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-popover-foreground outline-none hover:bg-accent transition-colors"
                onSelect={() => {
                  setCreatingSubfolder(true);
                  if (!folder.isExpanded) toggleFolder(folder.id);
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                新建子文件夹
              </ContextMenu.Item>
            )}
            <ContextMenu.Item
              className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-popover-foreground outline-none hover:bg-accent transition-colors"
              onSelect={() => {
                setRenaming(true);
                setRenameName(folder.name);
              }}
            >
              重命名
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-border" />
            <ContextMenu.Item
              className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-destructive outline-none hover:bg-accent transition-colors"
              onSelect={() => setShowDeleteDialog(true)}
            >
              删除文件夹
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="删除文件夹"
        description={getDeleteDescription()}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Children */}
      {folder.isExpanded && (
        <div>
          {/* Create subfolder input */}
          {creatingSubfolder && (
            <div className="py-0.5" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
              <input
                type="text"
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubfolder();
                  if (e.key === "Escape") {
                    setCreatingSubfolder(false);
                    setNewSubfolderName("");
                  }
                }}
                onBlur={handleCreateSubfolder}
                autoFocus
                placeholder="子文件夹名称"
                className="w-[calc(100%-8px)] rounded border border-brand bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {/* Subfolders */}
          {childFolders.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              notes={allNotes.filter((n) => n.folderId === child.id)}
              childFolders={allFolders.filter((f) => f.parentId === child.id)}
              allNotes={allNotes}
              allFolders={allFolders}
              depth={depth + 1}
            />
          ))}

          {/* Create note input */}
          {creatingNote && (
            <div className="py-0.5" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
              <input
                type="text"
                value={newNoteName}
                onChange={(e) => setNewNoteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNote();
                  if (e.key === "Escape") {
                    setCreatingNote(false);
                    setNewNoteName("");
                  }
                }}
                onBlur={handleCreateNote}
                autoFocus
                placeholder="笔记标题"
                className="w-[calc(100%-8px)] rounded border border-brand bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {/* Notes in this folder */}
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
