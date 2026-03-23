"use client";

import { useMemo } from "react";
import { useDiaryStore } from "@/stores/diary-store";
import { getCurrentISOWeekYear, getCurrentISOWeek, getWeekDaysUpToToday } from "@/lib/diary-utils";
import { DiaryWeekItem } from "@/components/diary/diary-week-item";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

export function DiarySidebar() {
  const selectedYear = useDiaryStore((s) => s.selectedYear);
  const prevYear = useDiaryStore((s) => s.prevYear);
  const nextYear = useDiaryStore((s) => s.nextYear);
  const loading = useDiaryStore((s) => s.loading);
  const diaryEntries = useDiaryStore((s) => s.diaryEntries);
  const expandedWeeks = useDiaryStore((s) => s.expandedWeeks);

  // 使用 useMemo 缓存计算结果，避免无限循环
  const weekGroups = useMemo(() => {
    // Group entries by weekNumber
    const weekMap = new Map<number, { weekly: typeof diaryEntries[0] | null; dailies: typeof diaryEntries }>();

    for (const entry of diaryEntries) {
      if (!weekMap.has(entry.weekNumber)) {
        weekMap.set(entry.weekNumber, { weekly: null, dailies: [] });
      }
      const group = weekMap.get(entry.weekNumber)!;
      if (entry.type === 'weekly') {
        group.weekly = entry;
      } else {
        group.dailies.push(entry);
      }
    }

    // Build week groups sorted by weekNumber descending
    const weekNumbers = Array.from(weekMap.keys()).sort((a, b) => b - a);

    return weekNumbers.map((weekNumber) => {
      const group = weekMap.get(weekNumber)!;
      const isCurrent = selectedYear === getCurrentISOWeekYear() && weekNumber === getCurrentISOWeek();

      // Sort dailies by date descending (newest first)
      group.dailies.sort((a, b) => b.date.localeCompare(a.date));

      // For current week, show all days from Monday to today
      // For history weeks, show only days that have entries
      let allDays: string[];
      if (isCurrent) {
        allDays = getWeekDaysUpToToday(selectedYear, weekNumber).reverse();
      } else {
        allDays = group.dailies.map((d) => d.date);
      }

      return {
        weekNumber,
        weeklyEntry: group.weekly,
        dailyEntries: group.dailies,
        allDays,
        isExpanded: expandedWeeks.includes(weekNumber),
      };
    });
  }, [diaryEntries, selectedYear, expandedWeeks]);

  const isCurrentYear = selectedYear >= getCurrentISOWeekYear();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-[41px] items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">日记</span>
        </div>
      </div>

      {/* Year selector */}
      <div className="flex h-[41px] items-center justify-center gap-2 border-b border-border px-3">
        <button
          onClick={prevYear}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground min-w-[4rem] text-center">
          {selectedYear}年
        </span>
        <button
          onClick={nextYear}
          disabled={isCurrentYear}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            加载中...
          </div>
        ) : weekGroups.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            暂无日记
          </div>
        ) : (
          <div className="space-y-0.5">
            {weekGroups.map((group) => (
              <DiaryWeekItem key={group.weekNumber} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
