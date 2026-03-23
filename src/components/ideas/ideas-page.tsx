"use client";

import { useEffect } from "react";
import { useIdeasStore } from "@/stores/ideas-store";
import { IdeaComposer } from "./idea-composer";
import { IdeaTimeline } from "./idea-timeline";
import { TagFilterBar } from "./tag-filter-bar";

export function IdeasPage() {
  const fetchIdeas = useIdeasStore((s) => s.fetchIdeas);
  const fetchTags = useIdeasStore((s) => s.fetchTags);
  const selectedTagId = useIdeasStore((s) => s.selectedTagId);

  useEffect(() => {
    fetchTags();
    fetchIdeas(true);
  }, [fetchTags, fetchIdeas]);

  // Re-fetch when tag filter changes
  useEffect(() => {
    fetchIdeas(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTagId]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-5xl gap-6 p-6">
        {/* Left column: Composer + Timeline */}
        <div className="flex-1 space-y-4">
          <IdeaComposer />
          <IdeaTimeline />
        </div>
        {/* Right column: Tag Filter */}
        <div className="w-64 shrink-0">
          <div className="sticky top-0">
            <TagFilterBar />
          </div>
        </div>
      </div>
    </div>
  );
}
