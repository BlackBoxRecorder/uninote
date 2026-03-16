"use client";

import { FileTree } from "@/components/file-tree/file-tree";
import { PlateEditor } from "@/components/editor/plate-editor";
import { Header } from "@/components/layout/header";
import { IdeasPage } from "@/components/ideas/ideas-page";
import { useAppStore } from "@/stores/app-store";
import { useEffect } from "react";

export function AppShell() {
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);
  const activeTab = useAppStore((s) => s.activeTab);
  const fetchTree = useAppStore((s) => s.fetchTree);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      {activeTab === "notes" ? (
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card">
            <FileTree />
          </aside>

          <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <PlateEditor key={selectedNoteId || "empty"} />
          </main>
        </div>
      ) : (
        <IdeasPage />
      )}
    </div>
  );
}
