"use client";

import { DiarySidebar } from "@/components/diary/diary-sidebar";
import { PlateEditor } from "@/components/editor/plate-editor";
import { useDiaryStore } from "@/stores/diary-store";
import { useEffect } from "react";

export function DiaryPage() {
  const selectedDiaryId = useDiaryStore((s) => s.selectedDiaryId);
  const initDiary = useDiaryStore((s) => s.initDiary);

  useEffect(() => {
    initDiary();
  }, [initDiary]);

  return (
    <div className="flex flex-1 justify-center overflow-hidden">
      <div className="flex h-full max-w-[1400px] w-full overflow-hidden">
        <aside className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card">
          <DiarySidebar />
        </aside>

        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <PlateEditor key={selectedDiaryId || "diary-empty"} />
        </main>
      </div>
    </div>
  );
}
