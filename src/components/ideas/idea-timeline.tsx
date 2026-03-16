"use client";

import { useRef, useEffect, useCallback } from "react";
import { useIdeasStore } from "@/stores/ideas-store";
import { IdeaCard } from "./idea-card";
import { Loader2 } from "lucide-react";

export function IdeaTimeline() {
  const ideas = useIdeasStore((s) => s.ideas);
  const hasMore = useIdeasStore((s) => s.hasMore);
  const loading = useIdeasStore((s) => s.loading);
  const fetchIdeas = useIdeasStore((s) => s.fetchIdeas);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasMore && !loading) {
        fetchIdeas(false);
      }
    },
    [hasMore, loading, fetchIdeas]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "200px",
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [handleIntersect]);

  if (ideas.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">还没有想法</p>
        <p className="mt-1 text-xs">在上方输入框中记录你的灵感</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasMore && ideas.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          没有更多了
        </p>
      )}
    </div>
  );
}
