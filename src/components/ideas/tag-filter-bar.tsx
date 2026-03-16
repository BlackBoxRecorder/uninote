"use client";

import { useIdeasStore } from "@/stores/ideas-store";
import { cn } from "@/lib/utils";

export function TagFilterBar() {
  const tags = useIdeasStore((s) => s.tags);
  const selectedTagId = useIdeasStore((s) => s.selectedTagId);
  const setSelectedTagId = useIdeasStore((s) => s.setSelectedTagId);
  const fetchIdeas = useIdeasStore((s) => s.fetchIdeas);

  const handleSelect = (tagId: string | null) => {
    setSelectedTagId(tagId);
    // fetchIdeas will be triggered by the effect in ideas-page
  };

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => handleSelect(null)}
        className={cn(
          "rounded-full px-3 py-1 text-xs transition-colors",
          selectedTagId === null
            ? "bg-brand text-white"
            : "bg-secondary text-secondary-foreground hover:bg-accent"
        )}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => handleSelect(tag.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition-colors",
            selectedTagId === tag.id
              ? "bg-brand text-white"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          )}
        >
          {tag.name}
          {tag.count !== undefined && (
            <span className="ml-1 opacity-60">{tag.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
