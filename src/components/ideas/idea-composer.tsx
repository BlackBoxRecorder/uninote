"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useIdeasStore } from "@/stores/ideas-store";
import { IdeaImageGrid } from "./idea-image-grid";
import { ImagePlus, Send, Loader2 } from "lucide-react";
import type { IdeaImage } from "@/types";

interface PendingImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export function IdeaComposer() {
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createIdea = useIdeasStore((s) => s.createIdea);

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const name = tagInput.trim().replace(/,/g, "");
      if (name && !tagNames.includes(name)) {
        setTagNames((prev) => [...prev, name]);
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && tagNames.length > 0) {
      setTagNames((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (name: string) => {
    setTagNames((prev) => prev.filter((t) => t !== name));
  };

  const handleUploadImage = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/ideas/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setImages((prev) => [
            ...prev,
            { id: data.id, url: data.url, width: data.width, height: data.height },
          ]);
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const result = await createIdea(
        trimmed,
        tagNames,
        images.map((img) => img.id)
      );
      if (result) {
        setContent("");
        setTagNames([]);
        setImages([]);
        setTagInput("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const ideaImages: IdeaImage[] = images.map((img) => ({
    id: img.id,
    ideaId: "",
    url: img.url,
    width: img.width,
    height: img.height,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="记录一个想法..."
        rows={3}
        className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {/* Tags input */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tagNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
          >
            {name}
            <button
              onClick={() => removeTag(name)}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder={tagNames.length === 0 ? "添加标签 (回车确认)" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {/* Pending images */}
      {images.length > 0 && (
        <div className="mt-3">
          <IdeaImageGrid
            images={ideaImages}
            removable
            onRemove={removeImage}
          />
        </div>
      )}

      {/* Actions bar */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadImage}
            disabled={uploading}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            图片
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          发布
        </button>
      </div>

      <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
        Ctrl+Enter 快速发布
      </p>
    </div>
  );
}
