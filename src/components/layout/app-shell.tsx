"use client";

import { FileTree } from "@/components/file-tree/file-tree";
import { PlateEditor } from "@/components/editor/plate-editor";
import { Header } from "@/components/layout/header";
import { IdeasPage } from "@/components/ideas/ideas-page";
import { DiaryPage } from "@/components/diary/diary-page";
import { useAppStore } from "@/stores/app-store";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab);
  const fetchTree = useAppStore((s) => s.fetchTree);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      <div className={cn("flex-1 overflow-hidden", activeTab !== "diary" && "hidden")}>
        <DiaryPage />
      </div>
      <div className={cn("flex flex-1 justify-center overflow-hidden", activeTab !== "notes" && "hidden")}>
        <div className="flex h-full max-w-[1400px] w-full overflow-hidden">
          <aside className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card">
            <FileTree />
          </aside>

          <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <PlateEditor />
          </main>
        </div>
      </div>
      <div className={cn("flex-1 overflow-hidden", activeTab !== "ideas" && "hidden")}>
        <IdeasPage />
      </div>
    </div>
  );
}
