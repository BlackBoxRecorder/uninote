"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { FileText } from "lucide-react";
import type { NoteMeta } from "@/types";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog, SaveConfirmDialog } from "@/components/ui/confirm-dialog";

interface NoteItemProps {
  note: NoteMeta;
  depth?: number;
}

export function NoteItem({ note, depth = 0 }: NoteItemProps) {
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useAppStore((s) => s.setSelectedNoteId);
  const renameNote = useAppStore((s) => s.renameNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const loadNote = useEditorStore((s) => s.loadNote);
  const switchToNote = useEditorStore((s) => s.switchToNote);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveCurrentNote = useEditorStore((s) => s.saveCurrentNote);

  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(note.title);
  const renameRef = useRef<HTMLInputElement>(null);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isActive = selectedNoteId === note.id;

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const handleClick = async () => {
    if (renaming) return;

    // 如果当前有未保存的内容，提示用户
    if (saveStatus === "unsaved") {
      setShowSaveDialog(true);
      return;
    }

    // 流程：
    // 1. 先加载笔记内容（loadNote 不改变 currentNoteId）
    // 2. 再切换到新笔记（switchToNote 更新 currentNoteId）
    // 这样可以确保：
    // - PlateEditor 重新挂载时，initialContent 已经是新笔记的内容
    await loadNote(note.id);
    switchToNote(note.id);
    setSelectedNoteId(note.id);
  };

  const handleSaveAndSwitch = async () => {
    const saved = await saveCurrentNote();
    if (saved) {
      await loadNote(note.id);
      switchToNote(note.id);
      setSelectedNoteId(note.id);
    }
  };

  const handleDiscardAndSwitch = async () => {
    await loadNote(note.id);
    switchToNote(note.id);
    setSelectedNoteId(note.id);
  };

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== note.title) {
      await renameNote(note.id, trimmed);
    }
    setRenaming(false);
  };

  const handleDownload = () => {
    window.location.href = `/api/notes/${note.id}/download`;
  };

  const handleDelete = async () => {
    await deleteNote(note.id);
  };

  return (
    <>
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <button
          onClick={handleClick}
          className={cn(
            "group flex w-full items-center gap-2 rounded-md py-1.5 text-sm transition-colors",
            isActive
              ? "bg-brand/10 text-brand"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
        >
          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
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
                  setRenameName(note.title);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onBlur={handleRename}
              className="flex-1 rounded border border-brand bg-background px-1 py-0 text-sm text-foreground focus:outline-none min-w-0"
            />
          ) : (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate">{note.title}</span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {note.title}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </button>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-xl z-50">
          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-popover-foreground outline-none hover:bg-accent transition-colors"
            onSelect={() => {
              setRenaming(true);
              setRenameName(note.title);
            }}
          >
            重命名
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-popover-foreground outline-none hover:bg-accent transition-colors"
            onSelect={handleDownload}
          >
            下载为 Markdown
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-border" />
          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-destructive outline-none hover:bg-accent transition-colors"
            onSelect={() => setShowDeleteDialog(true)}
          >
            删除
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>

    <SaveConfirmDialog
      open={showSaveDialog}
      onOpenChange={setShowSaveDialog}
      onSave={handleSaveAndSwitch}
      onDiscard={handleDiscardAndSwitch}
    />

    <ConfirmDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      title="删除笔记"
      description={`确定删除笔记 "${note.title}" 吗？删除后无法恢复。`}
      confirmText="删除"
      cancelText="取消"
      variant="destructive"
      onConfirm={handleDelete}
    />
    </>
  );
}
