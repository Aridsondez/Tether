import {
  TIMELINE_CATEGORY_COLORS,
  timelineCategoryColor,
  timelineColor,
  timelineGradient,
  timelineProgress,
  timelineShape,
} from './timeline-color';

// `atmosphere.tsx` pulls in expo-glass-effect for its GlassCard component,
// which this file never touches — mock it so these pure-logic tests don't
// need a native rendering environment for `mixHex`. Babel hoists this call
// above the import above at compile time.
jest.mock('@/components/atmosphere', () => ({
  mixHex: (a: string, b: string) => `mixed(${a},${b})`,
}));

const colors = { mine: '#111111', partner: '#222222' };

describe('timelineCategoryColor / timelineShape', () => {
  it('returns the mapped value for a known category', () => {
    expect(timelineCategoryColor('school')).toBe(TIMELINE_CATEGORY_COLORS.school);
    expect(timelineShape('school')).toBe('triangle');
  });

  it('falls back to "other" for null or undefined', () => {
    expect(timelineCategoryColor(null)).toBe(TIMELINE_CATEGORY_COLORS.other);
    expect(timelineShape(undefined)).toBe('circle');
  });
});

describe('timelineGradient', () => {
  it('uses both owner colors for a shared timeline', () => {
    expect(timelineGradient({ ownership: 'shared', created_by_you: true }, colors)).toEqual([
      colors.mine,
      colors.partner,
    ]);
  });

  it('is a solid gradient of the creator color for a personal timeline', () => {
    expect(timelineGradient({ ownership: 'mine', created_by_you: true }, colors)).toEqual([colors.mine, colors.mine]);
    expect(timelineGradient({ ownership: 'mine', created_by_you: false }, colors)).toEqual([
      colors.partner,
      colors.partner,
    ]);
  });
});

describe('timelineColor', () => {
  it('mixes both colors for a shared timeline', () => {
    expect(timelineColor({ ownership: 'shared', created_by_you: true }, colors)).toBe('mixed(#111111,#222222)');
  });

  it('picks the owner color for a personal timeline', () => {
    expect(timelineColor({ ownership: 'mine', created_by_you: true }, colors)).toBe(colors.mine);
    expect(timelineColor({ ownership: 'mine', created_by_you: false }, colors)).toBe(colors.partner);
  });
});

describe('timelineProgress', () => {
  it('reports zero fraction with no items', () => {
    expect(timelineProgress({ items: [] })).toEqual({ total: 0, completed: 0, fraction: 0 });
  });

  it('counts items with a completed_at as done', () => {
    const items = [
      { completed_at: '2026-01-01T00:00:00Z' },
      { completed_at: null },
      { completed_at: '2026-01-02T00:00:00Z' },
    ] as never;
    expect(timelineProgress({ items })).toEqual({ total: 3, completed: 2, fraction: 2 / 3 });
  });
});
