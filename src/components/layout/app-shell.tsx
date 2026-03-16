"use client";

import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { FileTree } from "@/components/file-tree/file-tree";
import { DocumentOutline } from "@/components/outline/document-outline";
import { PlateEditor } from "@/components/editor/plate-editor";
import { Header } from "@/components/layout/header";
import { IdeasPage } from "@/components/ideas/ideas-page";
import { useAppStore } from "@/stores/app-store";
import { useEffect } from "react";
import { GripVertical } from "lucide-react";

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative flex w-1.5 items-center justify-center bg-background transition-colors hover:bg-accent/30 active:bg-accent/50">
      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </PanelResizeHandle>
  );
}

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
        <PanelGroup orientation="horizontal" className="flex-1">
          <Panel defaultSize={20} minSize={12} maxSize={35}>
            <div className="flex h-full flex-col overflow-hidden border-r border-border bg-card">
              <FileTree />
            </div>
          </Panel>

          <ResizeHandle />

          <Panel defaultSize={60} minSize={30}>
            <div className="flex h-full flex-col overflow-hidden bg-background">
              <PlateEditor key={selectedNoteId || "empty"} />
            </div>
          </Panel>

          <ResizeHandle />

          <Panel defaultSize={20} minSize={10} maxSize={30}>
            <div className="flex h-full flex-col overflow-hidden border-l border-border bg-card">
              <DocumentOutline />
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        <IdeasPage />
      )}
    </div>
  );
}
