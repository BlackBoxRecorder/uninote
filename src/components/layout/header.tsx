"use client";

import { useRouter } from "next/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { useAppStore } from "@/stores/app-store";
import { FileText, LogOut, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const wordCount = useEditorStore((s) => s.wordCount);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const selectedNoteId = useAppStore((s) => s.selectedNoteId);

  const handleLogout = () => {
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  };

  const statusMap = {
    saved: { text: "已保存", color: "text-muted-foreground" },
    saving: { text: "保存中...", color: "text-brand" },
    unsaved: { text: "未保存", color: "text-yellow-600" },
    error: { text: "保存失败", color: "text-destructive" },
  };

  const status = statusMap[saveStatus];

  return (
    <header className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-1">
        <FileText className="mr-2 h-5 w-5 text-brand" />
        <span className="mr-4 text-sm font-semibold text-foreground">YNote</span>

        {/* Tab switcher */}
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-1 text-xs transition-colors",
              activeTab === "notes"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            笔记
          </button>
          <button
            onClick={() => setActiveTab("ideas")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-1 text-xs transition-colors",
              activeTab === "ideas"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            想法
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Save status + word count */}
        {activeTab === "notes" && selectedNoteId && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{wordCount} 字</span>
            <span className={status.color}>{status.text}</span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出
        </button>
      </div>
    </header>
  );
}
