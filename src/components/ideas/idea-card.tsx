"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import type { Idea } from "@/types";
import { useIdeasStore } from "@/stores/ideas-store";
import { IdeaImageGrid } from "./idea-image-grid";
import { formatRelativeTime } from "@/lib/time-format";
import { Pencil, Trash2, Check, X } from "lucide-react";

interface IdeaCardProps {
  idea: Idea;
}

export function IdeaCard({ idea }: IdeaCardProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(idea.content);
  const [editTagInput, setEditTagInput] = useState("");
  const [editTagNames, setEditTagNames] = useState<string[]>(
    idea.tags.map((t) => t.name)
  );
  const [confirming, setConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateIdea = useIdeasStore((s) => s.updateIdea);
  const deleteIdea = useIdeasStore((s) => s.deleteIdea);

  const handleStartEdit = () => {
    setEditContent(idea.content);
    setEditTagNames(idea.tags.map((t) => t.name));
    setEditTagInput("");
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setConfirming(false);
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    await updateIdea(idea.id, trimmed, editTagNames);
    setEditing(false);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && editTagInput.trim()) {
      e.preventDefault();
      const name = editTagInput.trim().replace(/,/g, "");
      if (name && !editTagNames.includes(name)) {
        setEditTagNames((prev) => [...prev, name]);
      }
      setEditTagInput("");
    }
    if (e.key === "Backspace" && !editTagInput && editTagNames.length > 0) {
      setEditTagNames((prev) => prev.slice(0, -1));
    }
  };

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteIdea(idea.id);
  };

  return (
    <div className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleEditKeyDown}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {editTagNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
              >
                {name}
                <button
                  onClick={() =>
                    setEditTagNames((prev) => prev.filter((t) => t !== name))
                  }
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              value={editTagInput}
              onChange={(e) => setEditTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="标签"
              className="min-w-[60px] flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs text-white hover:bg-brand/90"
            >
              <Check className="h-3 w-3" />
              保存
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-accent"
            >
              <X className="h-3 w-3" />
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Content */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {idea.content}
          </p>

          {/* Images */}
          {idea.images.length > 0 && (
            <div className="mt-3">
              <IdeaImageGrid images={idea.images} />
            </div>
          )}

          {/* Tags */}
          {idea.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(idea.createdAt)}
            </span>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={handleStartEdit}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                onBlur={() => setConfirming(false)}
                className={`rounded-md p-1 transition-colors ${
                  confirming
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-accent hover:text-destructive"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
