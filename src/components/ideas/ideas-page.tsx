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
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <IdeaComposer />
        <TagFilterBar />
        <IdeaTimeline />
      </div>
    </div>
  );
}
