import { create } from 'zustand';
import type { DiaryMeta } from '@/types';
import type { DiariesListResponse, ErrorResponse } from '@/types/api';
import { useEditorStore } from './editor-store';
import {
  getTodayStr,
  getCurrentISOWeekYear,
  getCurrentISOWeek,
  getWeekDaysUpToToday,
  isCurrentWeek,
} from '@/lib/diary-utils';

// 解析 API 错误响应
async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const data: ErrorResponse = await res.json();
    return data.error || '请求失败';
  } catch {
    return '请求失败';
  }
}

export interface DiaryWeekGroup {
  weekNumber: number;
  weeklyEntry: DiaryMeta | null;
  dailyEntries: DiaryMeta[];
  /** All days to show (current week shows all days up to today, history weeks show only days with entries) */
  allDays: string[];
  isExpanded: boolean;
}

interface DiaryState {
  selectedYear: number;
  diaryEntries: DiaryMeta[];
  selectedDiaryId: string | null;
  expandedWeeks: number[];
  loading: boolean;
  initialized: boolean;
  error: string | null;

  setSelectedYear: (year: number) => void;
  prevYear: () => void;
  nextYear: () => void;
  fetchDiaries: (year: number) => Promise<void>;
  ensureToday: () => Promise<{ daily: DiaryMeta; weekly: DiaryMeta } | null>;
  openDiary: (type: 'daily' | 'weekly', date: string) => Promise<void>;
  toggleWeek: (weekNumber: number) => void;
  initDiary: () => Promise<void>;
  getWeekGroups: () => DiaryWeekGroup[];
  clearError: () => void;
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  selectedYear: getCurrentISOWeekYear(),
  diaryEntries: [],
  selectedDiaryId: null,
  expandedWeeks: [getCurrentISOWeek()],
  loading: false,
  initialized: false,
  error: null,

  setSelectedYear: (year) => {
    set({ selectedYear: year });
    get().fetchDiaries(year);
  },

  prevYear: () => {
    const { selectedYear } = get();
    const newYear = selectedYear - 1;
    set({ selectedYear: newYear });
    get().fetchDiaries(newYear);
  },

  nextYear: () => {
    const { selectedYear } = get();
    const currentYear = getCurrentISOWeekYear();
    if (selectedYear >= currentYear) return;
    const newYear = selectedYear + 1;
    set({ selectedYear: newYear });
    get().fetchDiaries(newYear);
  },

  clearError: () => set({ error: null }),

  fetchDiaries: async (year) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/diaries?year=${year}`);
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const data: DiariesListResponse = await res.json();
      set({ diaryEntries: data.diaries, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : '获取日记列表失败';
      console.error('Failed to fetch diaries:', message);
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  ensureToday: async () => {
    try {
      const today = getTodayStr();
      const res = await fetch('/api/diaries/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ today }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }
      const data = await res.json();
      set({ error: null });
      return data as { daily: DiaryMeta; weekly: DiaryMeta };
    } catch (e) {
      const message = e instanceof Error ? e.message : '创建今日日记失败';
      console.error('Failed to ensure today diary:', message);
      set({ error: message });
      return null;
    }
  },

  openDiary: async (type, date) => {
    try {
      const res = await fetch('/api/diaries/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date }),
      });
      if (!res.ok) {
        const errorMsg = await parseErrorResponse(res);
        throw new Error(errorMsg);
      }

      const diary = await res.json();
      const editorStore = useEditorStore.getState();

      // If this entry is new and not in our list, add it
      const { diaryEntries } = get();
      const exists = diaryEntries.some((e) => e.id === diary.id);
      if (!exists) {
        set({
          diaryEntries: [
            ...diaryEntries,
            {
              id: diary.id,
              type: diary.type,
              date: diary.date,
              year: diary.year,
              weekNumber: diary.weekNumber,
              wordCount: diary.wordCount,
              createdAt: diary.createdAt,
              updatedAt: diary.updatedAt,
            },
          ],
        });
      }

      set({ selectedDiaryId: diary.id, error: null });
      editorStore.setEditingType('diary');
      await editorStore.loadDiary(diary.id);
      editorStore.switchToNote(diary.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : '打开日记失败';
      console.error('Failed to open diary:', message);
      set({ error: message });
    }
  },

  toggleWeek: (weekNumber) => {
    const { expandedWeeks } = get();
    if (expandedWeeks.includes(weekNumber)) {
      set({ expandedWeeks: expandedWeeks.filter((w) => w !== weekNumber) });
    } else {
      set({ expandedWeeks: [...expandedWeeks, weekNumber] });
    }
  },

  initDiary: async () => {
    const { initialized } = get();
    if (initialized) return;

    set({ loading: true });

    try {
      // 1. Ensure today's diary + this week's weekly diary exist
      const result = await get().ensureToday();

      // 2. Fetch all entries for current year
      const year = getCurrentISOWeekYear();
      set({ selectedYear: year });
      await get().fetchDiaries(year);

      // 3. Expand current week
      const currentWeek = getCurrentISOWeek();
      set({ expandedWeeks: [currentWeek], initialized: true, error: null });

      // 4. Auto-open today's daily diary
      if (result?.daily) {
        const editorStore = useEditorStore.getState();
        set({ selectedDiaryId: result.daily.id });
        editorStore.setEditingType('diary');
        await editorStore.loadDiary(result.daily.id);
        editorStore.switchToNote(result.daily.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '初始化日记失败';
      console.error('Failed to init diary:', message);
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  getWeekGroups: () => {
    const { diaryEntries, selectedYear, expandedWeeks } = get();

    // Group entries by weekNumber
    const weekMap = new Map<number, { weekly: DiaryMeta | null; dailies: DiaryMeta[] }>();

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
      const isCurrent = isCurrentWeek(selectedYear, weekNumber);

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
  },
}));
