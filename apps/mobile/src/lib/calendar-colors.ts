import type { EventCategory } from '@/lib/api';

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  date_night: '#FF7EA8',
  anniversary: '#FFD166',
  appointment: '#6C8CFF',
  travel: '#4ECDC4',
  family_friends: '#B39DDB',
  household: '#8D99AE',
  work: '#5C6B73',
  health: '#7BC67E',
  milestone: '#F4A261',
  reminder: '#EF767A',
  other: '#9AA0A8',
};

export function categoryColor(category: EventCategory | null | undefined): string {
  if (!category) return CATEGORY_COLORS.other;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}
