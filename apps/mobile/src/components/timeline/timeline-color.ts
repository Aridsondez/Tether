import { mixHex } from '@/components/atmosphere';
import type { Timeline, TimelineCategory } from '@/lib/api';

type TimelineColorInput = Pick<Timeline, 'ownership' | 'created_by_you'>;

/** The two real, user-picked identity colors — never the fixed PARTNER_A/PARTNER_B pair. */
export type OwnerColors = { mine: string; partner: string };

export type TimelineNodeShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon';

/** One accent color per category — used for filter chips and the small category pip on a node. */
export const TIMELINE_CATEGORY_COLORS: Record<TimelineCategory, string> = {
  school: '#4ECDC4',
  work: '#8D99AE',
  finances: '#FFD166',
  health: '#7BC67E',
  home: '#F4A261',
  travel: '#6C8CFF',
  relationship: '#FF7EA8',
  personal: '#B39DDB',
  other: '#9AA0A8',
};

/** Node body shape per category — grouped, since color still disambiguates categories that share a shape. */
const TIMELINE_CATEGORY_SHAPES: Record<TimelineCategory, TimelineNodeShape> = {
  school: 'triangle',
  work: 'square',
  finances: 'diamond',
  health: 'hexagon',
  home: 'hexagon',
  travel: 'hexagon',
  relationship: 'circle',
  personal: 'circle',
  other: 'circle',
};

export function timelineCategoryColor(category: TimelineCategory | null | undefined): string {
  if (!category) return TIMELINE_CATEGORY_COLORS.other;
  return TIMELINE_CATEGORY_COLORS[category] ?? TIMELINE_CATEGORY_COLORS.other;
}

export function timelineShape(category: TimelineCategory | null | undefined): TimelineNodeShape {
  if (!category) return TIMELINE_CATEGORY_SHAPES.other;
  return TIMELINE_CATEGORY_SHAPES[category] ?? TIMELINE_CATEGORY_SHAPES.other;
}

/** Gradient stops for this timeline's owner(s); a personal timeline is a degenerate solid-color gradient. */
export function timelineGradient(timeline: TimelineColorInput, colors: OwnerColors): [string, string] {
  if (timeline.ownership === 'shared') return [colors.mine, colors.partner];
  const color = timeline.created_by_you ? colors.mine : colors.partner;
  return [color, color];
}

/** A single representative color, for contexts (text, borders) that can't render a gradient. */
export function timelineColor(timeline: TimelineColorInput, colors: OwnerColors): string {
  if (timeline.ownership === 'shared') return mixHex(colors.mine, colors.partner);
  return timeline.created_by_you ? colors.mine : colors.partner;
}

export function timelineProgress(timeline: Pick<Timeline, 'items'>) {
  const total = timeline.items.length;
  const completed = timeline.items.filter((item) => item.completed_at).length;
  return { total, completed, fraction: total > 0 ? completed / total : 0 };
}
