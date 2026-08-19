export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Turn an ISO timestamp's calendar portion into local midnight without asking
 * JavaScript to reinterpret it as an instant in UTC. This is required for
 * all-day events: `2026-08-15T00:00:00Z` is August 15 on a calendar, even
 * though it is still the evening of August 14 in North American time zones.
 */
export function calendarDateFromIso(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function monthGridDays(anchor: Date): Date[] {
  return eachDayOfInterval(startOfWeek(startOfMonth(anchor)), endOfWeek(endOfMonth(anchor)));
}

const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const WEEK_RANGE_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const TIME_LABEL = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function weekdayShort(index: number): string {
  return WEEKDAY_SHORT[index];
}

export function formatMonthYear(date: Date): string {
  return MONTH_LABEL.format(date);
}

export function formatDayLabel(date: Date): string {
  return DAY_LABEL.format(date);
}

export function formatWeekRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${WEEK_RANGE_DAY.format(start)} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${WEEK_RANGE_DAY.format(start)} – ${WEEK_RANGE_DAY.format(end)}, ${end.getFullYear()}`;
}

export function formatTimeLabel(date: Date): string {
  return TIME_LABEL.format(date);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
