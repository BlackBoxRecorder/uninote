import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  eachDayOfInterval,
  format,
  parseISO,
  getDay,
  isAfter,
  startOfDay,
} from "date-fns";

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

/** Get today's ISO date string based on local time, e.g. '2026-03-18' */
export function getTodayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Get ISO week string, e.g. '2026-W12' */
export function getISOWeekStr(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Get week label in Chinese, e.g. '第12周' */
export function getWeekLabel(weekNumber: number): string {
  return `第${weekNumber}周`;
}

/** Get day label in Chinese from ISO date string, e.g. '3月18日' */
export function getDayLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  const month = MONTH_LABELS[date.getMonth()];
  const day = date.getDate();
  return `${month}${day}日`;
}

/** Get weekday label in Chinese from ISO date string, e.g. '周二' */
export function getWeekdayLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  return WEEKDAY_LABELS[getDay(date)];
}

/**
 * Get days of a given ISO week (year + weekNumber) up to today.
 * Returns ISO date strings from Monday to min(Sunday, today).
 * For future weeks returns empty array.
 */
export function getWeekDaysUpToToday(
  year: number,
  weekNumber: number
): string[] {
  // Build a date that falls into the desired ISO week
  // ISO week 1 contains Jan 4, so we start from Jan 4 of the ISO week year
  const jan4 = new Date(year, 0, 4);
  const weekStart = startOfISOWeek(jan4);
  // Offset to the target week
  const targetStart = new Date(
    weekStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000
  );
  const targetEnd = endOfISOWeek(targetStart);
  const today = startOfDay(new Date());

  // If the entire week is in the future, return empty
  if (isAfter(targetStart, today)) {
    return [];
  }

  const end = isAfter(targetEnd, today) ? today : targetEnd;
  return eachDayOfInterval({ start: targetStart, end }).map((d) =>
    format(d, "yyyy-MM-dd")
  );
}

/** Check if the given year + weekNumber is the current ISO week */
export function isCurrentWeek(year: number, weekNumber: number): boolean {
  const now = new Date();
  return getISOWeekYear(now) === year && getISOWeek(now) === weekNumber;
}

/** Check if a date string is today */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayStr();
}

/** Get current ISO week year */
export function getCurrentISOWeekYear(): number {
  return getISOWeekYear(new Date());
}

/** Get current ISO week number */
export function getCurrentISOWeek(): number {
  return getISOWeek(new Date());
}
