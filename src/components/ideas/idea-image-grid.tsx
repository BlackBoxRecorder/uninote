"use client";

import type { IdeaImage } from "@/types";
import { useState } from "react";
import { X } from "lucide-react";

interface IdeaImageGridProps {
  images: IdeaImage[];
  removable?: boolean;
  onRemove?: (id: string) => void;
}

export function IdeaImageGrid({ images, removable, onRemove }: IdeaImageGridProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (images.length === 0) return null;

  const gridClass =
    images.length === 1
      ? "grid-cols-1 max-w-xs"
      : images.length === 2
        ? "grid-cols-2 max-w-sm"
        : "grid-cols-3 max-w-md";

  return (
    <>
      <div className={`grid ${gridClass} gap-1.5`}>
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
          >
            <img
              src={img.url}
              alt=""
              className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
              onClick={() => setPreviewUrl(img.url)}
            />
            {removable && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(img.id);
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
