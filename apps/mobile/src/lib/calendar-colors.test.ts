import { CATEGORY_COLORS, categoryColor } from './calendar-colors';

describe('categoryColor', () => {
  it('returns the mapped color for a known category', () => {
    expect(categoryColor('travel')).toBe(CATEGORY_COLORS.travel);
  });

  it('falls back to "other" for null or undefined', () => {
    expect(categoryColor(null)).toBe(CATEGORY_COLORS.other);
    expect(categoryColor(undefined)).toBe(CATEGORY_COLORS.other);
  });
});
