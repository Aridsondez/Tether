import {
  addDays,
  addMonths,
  calendarDateFromIso,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  formatWeekRange,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from './date-utils';

describe('startOfDay', () => {
  it('zeroes out the time-of-day', () => {
    const result = startOfDay(new Date(2026, 7, 15, 13, 45, 30));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getDate()).toBe(15);
  });
});

describe('calendarDateFromIso', () => {
  it('reads the calendar date without shifting for timezone', () => {
    const result = calendarDateFromIso('2026-08-15T00:00:00Z');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(15);
  });
});

describe('addDays / addMonths', () => {
  it('adds days across a month boundary', () => {
    const result = addDays(new Date(2026, 0, 30), 3);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(2);
  });

  it('adds months', () => {
    const result = addMonths(new Date(2026, 0, 15), 2);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });
});

describe('startOfWeek / endOfWeek', () => {
  it('starts on Sunday and ends on Saturday', () => {
    const wednesday = new Date(2026, 7, 19);
    const start = startOfWeek(wednesday);
    const end = endOfWeek(wednesday);
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(start.getDate()).toBe(16);
    expect(end.getDate()).toBe(22);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('returns the first and last day of the month', () => {
    const mid = new Date(2026, 1, 10);
    expect(startOfMonth(mid).getDate()).toBe(1);
    expect(endOfMonth(mid).getDate()).toBe(28); // Feb 2026 is not a leap year
  });
});

describe('isSameDay', () => {
  it('ignores time-of-day', () => {
    expect(isSameDay(new Date(2026, 7, 15, 1), new Date(2026, 7, 15, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 7, 15), new Date(2026, 7, 16))).toBe(false);
  });
});

describe('eachDayOfInterval', () => {
  it('includes both endpoints', () => {
    const days = eachDayOfInterval(new Date(2026, 7, 1), new Date(2026, 7, 3));
    expect(days).toHaveLength(3);
    expect(days[0].getDate()).toBe(1);
    expect(days[2].getDate()).toBe(3);
  });
});

describe('formatWeekRange', () => {
  it('omits the repeated year/month within the same month', () => {
    const result = formatWeekRange(new Date(2026, 7, 16), new Date(2026, 7, 22));
    expect(result).toBe('Aug 16 – 22, 2026');
  });

  it('spells out both ends across a month boundary', () => {
    const result = formatWeekRange(new Date(2026, 6, 29), new Date(2026, 7, 4));
    expect(result).toBe('Jul 29 – Aug 4, 2026');
  });
});

describe('isToday', () => {
  it('is true only for the current calendar day', () => {
    expect(isToday(new Date())).toBe(true);
    expect(isToday(addDays(new Date(), -1))).toBe(false);
  });
});
