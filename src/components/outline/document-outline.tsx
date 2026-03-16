"use client";

import { useEditorStore } from "@/stores/editor-store";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

export function DocumentOutline() {
  const headings = useEditorStore((s) => s.headings);
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);

  const handleClick = (id: string) => {
    const el = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <List className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">大纲</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!selectedNoteId && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">未选择笔记</p>
        )}

        {selectedNoteId && headings.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">暂无标题</p>
        )}

        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => handleClick(heading.id)}
            className={cn(
              "block w-full truncate rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
              heading.level === 1 && "font-semibold text-foreground",
              heading.level === 2 && "pl-4 text-foreground",
              heading.level === 3 && "pl-6 text-muted-foreground",
              heading.level === 4 && "pl-8 text-muted-foreground text-xs",
              heading.level === 5 && "pl-10 text-muted-foreground text-xs",
              heading.level === 6 && "pl-12 text-muted-foreground text-xs"
            )}
          >
            {heading.text}
          </button>
        ))}
      </div>
    </div>
  );
}
