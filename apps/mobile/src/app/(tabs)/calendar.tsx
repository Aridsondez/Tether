import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Atmosphere, hexToRgba, PARTNER_A } from '@/components/atmosphere';
import { CalendarConnectionsSheet } from '@/components/calendar-connections-sheet';
import { CalendarEventSheet } from '@/components/calendar-event-sheet';
import { SkeletonBlock } from '@/components/skeleton';
import { timelineCategoryColor } from '@/components/timeline/timeline-color';
import { ApiError, tetherApi, type CalendarEvent, type CalendarEventsResponse, type EventDraft, type ExternalCalendarEvent, type Timeline } from '@/lib/api';
import { categoryColor } from '@/lib/calendar-colors';
import {
  addDays,
  addMonths,
  calendarDateFromIso,
  endOfMonth,
  endOfWeek,
  formatDayLabel,
  formatMonthYear,
  formatTimeLabel,
  formatWeekRange,
  isSameDay,
  isToday,
  monthGridDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekdayShort,
} from '@/lib/date-utils';

type ViewMode = 'month' | 'week';

type AgendaItem = {
  key: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  source: 'tether' | 'external' | 'timeline';
  event?: CalendarEvent;
  feedName?: string;
  masked: boolean;
  timelineId?: string;
  itemId?: string;
};

function toAgendaItems(events: CalendarEvent[], external: ExternalCalendarEvent[], timelines: Timeline[]): AgendaItem[] {
  const tetherItems: AgendaItem[] = events.map((event) => ({
    key: event.instance_id,
    title: event.title,
    startAt: event.all_day ? calendarDateFromIso(event.start_at) : new Date(event.start_at),
    endAt: event.all_day ? calendarDateFromIso(event.end_at) : new Date(event.end_at),
    allDay: event.all_day,
    color: event.color ?? categoryColor(event.category),
    source: 'tether',
    event,
    masked: event.masked,
  }));
  const externalItems: AgendaItem[] = external.map((item) => ({
    key: item.instance_id,
    title: item.title,
    startAt: item.all_day ? calendarDateFromIso(item.start_at) : new Date(item.start_at),
    endAt: item.all_day ? calendarDateFromIso(item.end_at) : new Date(item.end_at),
    allDay: item.all_day,
    color: item.color,
    source: 'external',
    feedName: item.feed_name,
    masked: false,
  }));
  // Dated timeline milestones are derived, not stored calendar events — a lightweight
  // one-way link so the calendar can surface goal deadlines without a sync layer.
  const timelineItems: AgendaItem[] = timelines.flatMap((timeline) =>
    timeline.items
      .filter((item): item is typeof item & { target_date: string } => Boolean(item.target_date))
      .map((item) => {
        const date = calendarDateFromIso(item.target_date);
        return {
          key: `timeline-${item.id}`,
          title: `${timeline.title} · ${item.title}`,
          startAt: date,
          endAt: date,
          allDay: true,
          color: timelineCategoryColor(timeline.category),
          source: 'timeline' as const,
          masked: false,
          timelineId: timeline.id,
          itemId: item.id,
        };
      }),
  );
  return [...tetherItems, ...externalItems, ...timelineItems].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function itemsForDay(items: AgendaItem[], day: Date): AgendaItem[] {
  const target = startOfDay(day).getTime();
  return items.filter((item) => startOfDay(item.startAt).getTime() <= target && startOfDay(item.endAt).getTime() >= target);
}

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

function rangeFor(viewMode: ViewMode, anchorDate: Date) {
  if (viewMode === 'month') {
    return { start: startOfWeek(startOfMonth(anchorDate)), end: endOfWeek(endOfMonth(anchorDate)) };
  }
  return { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) };
}

function rangeCacheKey(start: Date, end: Date) {
  return `${start.toISOString()}_${end.toISOString()}`;
}

// A same-shape stand-in for the row the server will eventually return, so a
// newly created event can render immediately instead of waiting on a round trip.
function optimisticEventFromDraft(draft: EventDraft): CalendarEvent {
  const id = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    instance_id: id,
    is_recurring: (draft.recurrence_freq ?? 'none') !== 'none',
    title: draft.title,
    description: draft.description ?? null,
    location: draft.location ?? null,
    place_id: draft.place_id ?? null,
    place: null,
    category: draft.category,
    start_at: draft.start_at,
    end_at: draft.end_at,
    all_day: draft.all_day ?? false,
    visibility: draft.visibility ?? 'shared',
    hidden_until: draft.hidden_until ?? null,
    recurrence_freq: draft.recurrence_freq ?? 'none',
    recurrence_until: draft.recurrence_until ?? null,
    reminder_minutes: draft.reminder_minutes ?? null,
    color: draft.color ?? null,
    created_by_you: true,
    created_by_name: null,
    masked: false,
  };
}

// Small LRU cap so paging through many months in one session doesn't grow unbounded.
const RANGE_CACHE_LIMIT = 16;

function cacheRangeResult(cache: Map<string, CalendarEventsResponse>, key: string, value: CalendarEventsResponse) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > RANGE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

export default function CalendarScreen() {
  const { getToken, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rangeCacheRef = useRef(new Map<string, CalendarEventsResponse>());
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [connectionsVisible, setConnectionsVisible] = useState(false);
  const [sheetInitialStart, setSheetInitialStart] = useState<Date>(() => new Date());

  const range = useMemo(() => rangeFor(viewMode, anchorDate), [viewMode, anchorDate]);

  // Fetches one range and always updates the cache; callers decide whether to
  // reflect the result in state (the visible range does, prefetches don't).
  const fetchRange = useCallback(async (start: Date, end: Date): Promise<CalendarEventsResponse> => {
    const token = await getTokenRef.current();
    if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
    const rangeEnd = addDays(end, 1);
    const response = await tetherApi.listCalendarEvents(token, start.toISOString(), rangeEnd.toISOString());
    cacheRangeResult(rangeCacheRef.current, rangeCacheKey(start, rangeEnd), response);
    return response;
  }, []);

  const loadEvents = useCallback(async () => {
    if (!isSignedIn) return;
    const rangeEnd = addDays(range.end, 1);
    const cached = rangeCacheRef.current.get(rangeCacheKey(range.start, rangeEnd));
    setError(null);

    if (cached) {
      // Stale-while-revalidate: paint the last-known result immediately so
      // paging never looks blank, then quietly refresh it underneath.
      setEvents(cached.events);
      setExternalEvents(cached.external_events);
      setLoading(false);
      setRevalidating(true);
      try {
        const fresh = await fetchRange(range.start, range.end);
        setEvents(fresh.events);
        setExternalEvents(fresh.external_events);
      } catch (reason) {
        console.error('[Tether] Calendar revalidation failed:', reason);
      } finally {
        setRevalidating(false);
      }
      return;
    }

    setLoading(true);
    try {
      const fresh = await fetchRange(range.start, range.end);
      setEvents(fresh.events);
      setExternalEvents(fresh.external_events);
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, range.start, range.end, fetchRange]);

  // Timelines are fetched whole (not range-paged), so a dated milestone can be
  // merged into any agenda view without a separate calendar-linking endpoint.
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const { timelines: loaded } = await tetherApi.listTimelines(token);
        setTimelines(loaded);
      } catch (reason) {
        console.error('[Tether] Failed to load timelines for calendar:', reason);
      }
    })();
  }, [isSignedIn]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Warm the cache for the adjacent month/week so next/prev navigation reads
  // from cache (instant) instead of waiting on a network round trip.
  useEffect(() => {
    if (!isSignedIn) return;
    const neighborAnchors = viewMode === 'month'
      ? [addMonths(anchorDate, -1), addMonths(anchorDate, 1)]
      : [addDays(anchorDate, -7), addDays(anchorDate, 7)];
    for (const neighborAnchor of neighborAnchors) {
      const neighborRange = rangeFor(viewMode, neighborAnchor);
      const key = rangeCacheKey(neighborRange.start, addDays(neighborRange.end, 1));
      if (!rangeCacheRef.current.has(key)) {
        void fetchRange(neighborRange.start, neighborRange.end).catch(() => {});
      }
    }
  }, [isSignedIn, viewMode, anchorDate, fetchRange]);

  function invalidateAndReload() {
    rangeCacheRef.current.clear();
    return loadEvents();
  }

  // After a mutation, other cached ranges may now be stale (a recurring event
  // can span months), so drop them all and quietly refresh the visible one.
  async function reconcileCurrentRange() {
    rangeCacheRef.current.clear();
    setRevalidating(true);
    try {
      const fresh = await fetchRange(range.start, range.end);
      setEvents(fresh.events);
      setExternalEvents(fresh.external_events);
    } catch (reason) {
      console.error('[Tether] Calendar reconciliation failed:', reason);
    } finally {
      setRevalidating(false);
    }
  }

  function upsertLocalEvent(event: CalendarEvent) {
    setEvents((prev) => (prev.some((entry) => entry.id === event.id) ? prev.map((entry) => (entry.id === event.id ? event : entry)) : [...prev, event]));
  }

  function patchLocalEvent(id: string, patch: Partial<CalendarEvent>) {
    setEvents((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function removeLocalEvent(id: string) {
    setEvents((prev) => prev.filter((entry) => entry.id !== id));
  }

  const agendaItems = useMemo(() => toAgendaItems(events, externalEvents, timelines), [events, externalEvents, timelines]);

  function goToday() {
    const today = startOfDay(new Date());
    setAnchorDate(today);
    setSelectedDate(today);
  }

  function goPrev() {
    setAnchorDate((current) => (viewMode === 'month' ? addMonths(current, -1) : addDays(current, -7)));
  }

  function goNext() {
    setAnchorDate((current) => (viewMode === 'month' ? addMonths(current, 1) : addDays(current, 7)));
  }

  function openCreate(day: Date) {
    const start = new Date(day);
    if (isSameDay(day, new Date())) {
      const now = new Date();
      start.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    setEditingEvent(null);
    setSheetVisible(true);
    setSheetInitialStart(start);
  }

  function openEdit(event: CalendarEvent) {
    if (event.masked) return;
    setEditingEvent(event);
    setSheetVisible(true);
  }

  function handleAgendaPress(item: AgendaItem) {
    if (item.source === 'timeline' && item.timelineId) {
      router.push({ pathname: '/timeline', params: { openTimelineId: item.timelineId, openItemId: item.itemId ?? '' } });
      return;
    }
    if (item.event) openEdit(item.event);
  }

  async function handleSave(draft: EventDraft) {
    setError(null);
    setSheetBusy(true);
    const token = await getTokenRef.current();
    setSheetBusy(false);
    if (!token) {
      setError('Your sign-in session has expired. Please sign in again.');
      return;
    }

    if (editingEvent) {
      // Non-recurring edits are exact; a recurring series' per-occurrence
      // times stay put until the background reconcile re-expands them.
      const recurring = editingEvent.recurrence_freq !== 'none';
      const patch: Partial<CalendarEvent> = {
        title: draft.title,
        description: draft.description ?? null,
        location: draft.location ?? null,
        category: draft.category,
        visibility: draft.visibility ?? editingEvent.visibility,
        color: draft.color ?? editingEvent.color,
      };
      if (!recurring) {
        patch.start_at = draft.start_at;
        patch.end_at = draft.end_at;
        patch.all_day = draft.all_day ?? editingEvent.all_day;
      }
      patchLocalEvent(editingEvent.id, patch);
      setSheetVisible(false);
      try {
        await tetherApi.updateEvent(token, editingEvent.id, draft);
      } catch (reason) {
        setError(userMessage(reason));
      }
      await reconcileCurrentRange();
      return;
    }

    const optimistic = optimisticEventFromDraft(draft);
    upsertLocalEvent(optimistic);
    setSheetVisible(false);
    try {
      await tetherApi.createEvent(token, draft);
    } catch (reason) {
      setError(userMessage(reason));
    }
    await reconcileCurrentRange();
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setError(null);
    const token = await getTokenRef.current();
    if (!token) {
      setError('Your sign-in session has expired. Please sign in again.');
      return;
    }
    removeLocalEvent(editingEvent.id);
    setSheetVisible(false);
    try {
      await tetherApi.deleteEvent(token, editingEvent.id);
    } catch (reason) {
      setError(userMessage(reason));
    }
    await reconcileCurrentRange();
  }

  return (
    <Atmosphere>
      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>TETHER</Text>
            <Text style={styles.title}>{viewMode === 'month' ? formatMonthYear(anchorDate) : formatWeekRange(range.start, range.end)}</Text>
          </View>
          <Pressable onPress={() => setConnectionsVisible(true)} style={styles.calendarsButton} hitSlop={8}>
            <Text style={styles.calendarsButtonText}>Calendars</Text>
          </Pressable>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.segmented}>
            <SegmentButton label="Month" selected={viewMode === 'month'} onPress={() => setViewMode('month')} />
            <SegmentButton label="Week" selected={viewMode === 'week'} onPress={() => setViewMode('week')} />
          </View>
          <View style={styles.navRow}>
            <Pressable onPress={goPrev} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navChevron}>‹</Text>
            </Pressable>
            <Pressable onPress={goToday} hitSlop={8}>
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
            <Pressable onPress={goNext} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navChevron}>›</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {viewMode === 'month' ? (
            <MonthGrid
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              agendaItems={agendaItems}
              onSelectDay={setSelectedDate}
            />
          ) : null}

          {revalidating ? <ActivityIndicator color="#71757F" size="small" style={styles.loading} /> : null}

          {loading ? (
            <AgendaSkeleton />
          ) : viewMode === 'month' ? (
            <DayAgenda day={selectedDate} items={itemsForDay(agendaItems, selectedDate)} onPressItem={handleAgendaPress} />
          ) : (
            <WeekAgenda
              weekStart={range.start}
              agendaItems={agendaItems}
              onPressItem={handleAgendaPress}
            />
          )}
        </ScrollView>

        <Pressable
          onPress={() => openCreate(selectedDate)}
          accessibilityLabel="Add calendar event"
          style={[styles.fab, { bottom: insets.bottom + 84 }]}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </SafeAreaView>

      <CalendarEventSheet
        visible={sheetVisible}
        event={editingEvent}
        initialStart={sheetInitialStart}
        busy={sheetBusy}
        getToken={() => getTokenRef.current()}
        onClose={() => setSheetVisible(false)}
        onSave={handleSave}
        onDelete={editingEvent ? handleDelete : undefined}
      />

      <CalendarConnectionsSheet
        visible={connectionsVisible}
        onClose={() => setConnectionsVisible(false)}
        getToken={() => getTokenRef.current()}
        onFeedsChanged={() => void invalidateAndReload()}
      />
    </Atmosphere>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, selected && styles.segmentButtonSelected]}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MonthGrid({
  anchorDate,
  selectedDate,
  agendaItems,
  onSelectDay,
}: {
  anchorDate: Date;
  selectedDate: Date;
  agendaItems: AgendaItem[];
  onSelectDay: (day: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(anchorDate), [anchorDate]);
  // Do not rely on seven percentage widths adding up exactly. Yoga can round
  // 14.285…% upward and wrap the seventh cell to the next line, which shifts
  // every date after it under the wrong weekday. Rows make the seven-day
  // calendar invariant explicit on every device density.
  const weeks = useMemo(
    () => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7)),
    [days],
  );
  const currentMonth = anchorDate.getMonth();

  return (
    <View style={styles.monthCard}>
      <View style={styles.weekdayRow}>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Text key={index} style={styles.weekdayLabel}>{weekdayShort(index)}</Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {weeks.map((week) => (
          <View key={week[0]?.toISOString()} style={styles.weekRow}>
            {week.map((day) => {
              const inMonth = day.getMonth() === currentMonth;
              const dayItems = itemsForDay(agendaItems, day);
              const dots = dayItems.slice(0, 4);
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => onSelectDay(day)}
                  style={styles.dayCell}>
                  <View style={[
                    styles.dayNumberWrap,
                    isSameDay(day, selectedDate) && styles.dayNumberSelected,
                    isToday(day) && !isSameDay(day, selectedDate) && styles.dayNumberToday,
                  ]}>
                    <Text style={[
                      styles.dayNumber,
                      !inMonth && styles.dayNumberDim,
                      isSameDay(day, selectedDate) && styles.dayNumberTextSelected,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  <View style={styles.dotsRow}>
                    {dots.map((item) => (
                      <View key={item.key} style={[styles.dot, { backgroundColor: item.color }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DayAgenda({ day, items, onPressItem }: { day: Date; items: AgendaItem[]; onPressItem: (item: AgendaItem) => void }) {
  return (
    <View style={styles.agendaSection}>
      <Text style={styles.agendaHeading}>{isToday(day) ? 'Today' : formatDayLabel(day)}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing on the calendar.</Text>
      ) : (
        items.map((item) => <AgendaRow key={item.key} item={item} onPress={onPressItem} />)
      )}
    </View>
  );
}

function WeekAgenda({
  weekStart,
  agendaItems,
  onPressItem,
}: {
  weekStart: Date;
  agendaItems: AgendaItem[];
  onPressItem: (item: AgendaItem) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  return (
    <View style={styles.weekAgendaWrap}>
      {days.map((day) => (
        <DayAgenda key={day.toISOString()} day={day} items={itemsForDay(agendaItems, day)} onPressItem={onPressItem} />
      ))}
    </View>
  );
}

function AgendaRow({ item, onPress }: { item: AgendaItem; onPress: (item: AgendaItem) => void }) {
  const disabled = item.source === 'external' || item.masked;
  const timeLabel = item.allDay
    ? 'All day'
    : `${formatTimeLabel(item.startAt)} – ${formatTimeLabel(item.endAt)}`;

  return (
    <Pressable
      onPress={() => onPress(item)}
      disabled={disabled}
      style={[styles.agendaRow, disabled && styles.agendaRowDisabled]}>
      <View style={[styles.agendaBar, { backgroundColor: item.color }]} />
      <View style={styles.agendaInfo}>
        <Text style={[styles.agendaTitle, item.masked && styles.agendaTitleMasked]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.agendaTime}>
          {timeLabel}
          {item.source === 'external' ? ` · ${item.feedName}` : ''}
        </Text>
      </View>
      {item.source === 'tether' && item.event?.created_by_you === false && !item.masked && (
        <View style={[styles.partnerTag, { backgroundColor: hexToRgba(PARTNER_A, 0.16) }]}>
          <Text style={styles.partnerTagText}>Partner</Text>
        </View>
      )}
      {item.source === 'timeline' && (
        <View style={[styles.partnerTag, { backgroundColor: hexToRgba(item.color, 0.18) }]}>
          <Text style={[styles.partnerTagText, { color: item.color }]}>Timeline</Text>
        </View>
      )}
    </Pressable>
  );
}

function AgendaSkeleton() {
  return (
    <View style={styles.agendaSection}>
      <SkeletonBlock width={90} height={15} />
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.agendaRow}>
          <SkeletonBlock width={4} height={30} radius={3} />
          <View style={styles.agendaInfo}>
            <SkeletonBlock width={key === 1 ? '50%' : '70%'} height={14} />
            <SkeletonBlock width={90} height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  headerRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: '#AEBBFF', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  title: { color: '#F7F8FA', fontSize: 26, fontWeight: '700', letterSpacing: -0.6, marginTop: 6 },
  calendarsButton: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  calendarsButtonText: { color: '#C5C9D8', fontSize: 13, fontWeight: '600' },
  controlsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  segmented: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, flexDirection: 'row', padding: 3 },
  segmentButton: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  segmentButtonSelected: { backgroundColor: 'rgba(255,255,255,0.14)' },
  segmentText: { color: '#8E93A1', fontSize: 13, fontWeight: '700' },
  segmentTextSelected: { color: '#F7F8FA' },
  navRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  navButton: { paddingHorizontal: 2 },
  navChevron: { color: PARTNER_A, fontSize: 22, fontWeight: '700' },
  todayText: { color: '#C5C9D8', fontSize: 13, fontWeight: '600' },
  error: { color: '#FF9A9A', fontSize: 13, marginTop: 12 },
  scrollContent: { paddingBottom: 120, paddingTop: 16 },
  loading: { marginVertical: 12 },
  monthCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { color: '#71757F', flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  monthGrid: { gap: 2 },
  weekRow: { flexDirection: 'row' },
  dayCell: { alignItems: 'center', flex: 1, gap: 4, paddingVertical: 6 },
  dayNumberWrap: { alignItems: 'center', borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  dayNumberSelected: { backgroundColor: PARTNER_A },
  dayNumberToday: { borderColor: PARTNER_A, borderWidth: 1.5 },
  dayNumber: { color: '#E4E6EC', fontSize: 14, fontWeight: '600' },
  dayNumberDim: { color: '#4B4E58' },
  dayNumberTextSelected: { color: '#0B0C10', fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 3, height: 6, justifyContent: 'center' },
  dot: { borderRadius: 3, height: 5, width: 5 },
  agendaSection: { gap: 10, marginTop: 22 },
  agendaHeading: { color: '#F7F8FA', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#71757F', fontSize: 13 },
  weekAgendaWrap: { gap: 4 },
  agendaRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, padding: 12 },
  agendaRowDisabled: { opacity: 0.75 },
  agendaBar: { borderRadius: 3, height: 30, width: 4 },
  agendaInfo: { flex: 1, gap: 2 },
  agendaTitle: { color: '#F7F8FA', fontSize: 14, fontWeight: '600' },
  agendaTitleMasked: { fontStyle: 'italic' },
  agendaTime: { color: '#8E93A1', fontSize: 12 },
  partnerTag: { borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 },
  partnerTagText: { color: '#AEB6FF', fontSize: 10, fontWeight: '700' },
  fab: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 28, height: 56, justifyContent: 'center', position: 'absolute', right: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, width: 56 },
  fabText: { color: '#1B1E2B', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
