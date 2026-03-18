"use client";

import { cn } from "@/lib/utils";
import {
  getWeekLabel,
  getDayLabel,
  getWeekdayLabel,
  isToday,
} from "@/lib/diary-utils";
import { useDiaryStore, type DiaryWeekGroup } from "@/stores/diary-store";
import { useEditorStore } from "@/stores/editor-store";
import { ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { SaveConfirmDialog } from "@/components/ui/confirm-dialog";

import { useState, useCallback } from "react";

export function DiaryWeekItem({ group }: { group: DiaryWeekGroup }) {
  const selectedDiaryId = useDiaryStore((s) => s.selectedDiaryId);
  const toggleWeek = useDiaryStore((s) => s.toggleWeek);
  const openDiary = useDiaryStore((s) => s.openDiary);
  const selectedYear = useDiaryStore((s) => s.selectedYear);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const saveCurrentNote = useEditorStore((s) => s.saveCurrentNote);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleSafeAction = useCallback(
    (action: () => void) => {
      if (saveStatus === "unsaved") {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [saveStatus]
  );

  const handleWeekClick = () => {
    toggleWeek(group.weekNumber);
    const weekDate = `${selectedYear}-W${String(group.weekNumber).padStart(2, "0")}`;
    handleSafeAction(() => openDiary("weekly", weekDate));
  };

  const handleDayClick = (date: string) => {
    handleSafeAction(() => openDiary("daily", date));
  };

  const isWeeklyActive = group.weeklyEntry?.id === selectedDiaryId;

  return (
    <>
      {/* Week header */}
      <button
        onClick={handleWeekClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent",
          isWeeklyActive && "bg-brand/10 text-brand"
        )}
      >
        {group.isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">{getWeekLabel(group.weekNumber)}</span>
      </button>

      {/* Expanded: daily entries */}
      {group.isExpanded && (
        <div className="ml-3 border-l border-border pl-2">
          {group.allDays.map((date) => {
            const entry = group.dailyEntries.find((e) => e.date === date);
            const isActive = entry?.id === selectedDiaryId;
            const isTodayDate = isToday(date);
            const hasEntry = !!entry;

            return (
              <button
                key={date}
                onClick={() => handleDayClick(date)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent",
                  isActive && "bg-brand/10 text-brand",
                  !hasEntry && !isActive && "text-muted-foreground"
                )}
              >
                {isTodayDate && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                )}
                <span>{getDayLabel(date)}</span>
                <span className="text-muted-foreground">
                  {getWeekdayLabel(date)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Save confirm dialog */}
      {pendingAction && (
        <SaveConfirmDialog
          open={!!pendingAction}
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          onSave={async () => {
            await saveCurrentNote();
            pendingAction();
            setPendingAction(null);
          }}
          onDiscard={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}
    </>
  );
}
