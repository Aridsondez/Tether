import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { SkeletonCircle, SkeletonBlock } from '@/components/skeleton';
import { CreateTimelineSheet } from '@/components/timeline/create-timeline-sheet';
import { timelineCategoryColor, type OwnerColors } from '@/components/timeline/timeline-color';
import { TimelineDetailSheet } from '@/components/timeline/timeline-detail-sheet';
import { TimelineSpace } from '@/components/timeline/timeline-space';
import { ApiError, tetherApi, TIMELINE_CATEGORIES, type Timeline, type TimelineCategory, type TimelineItem } from '@/lib/api';

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

export default function TimelineScreen() {
  const { getToken, isSignedIn } = useAuth();
  const tokenRef = useRef<string | null>(null);
  // getToken's identity from useAuth() isn't stable across renders — depending
  // on it directly would rerun these effects (and refetch) on every render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);
  const params = useLocalSearchParams<{ openTimelineId?: string; openItemId?: string }>();

  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<TimelineCategory>>(new Set());

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<Timeline | null>(null);
  const [detailTimeline, setDetailTimeline] = useState<Timeline | null>(null);
  const [autoOpenItemId, setAutoOpenItemId] = useState<string | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [colors, setColors] = useState<OwnerColors>({ mine: PARTNER_A, partner: PARTNER_B });

  const loadTimelines = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    tokenRef.current = token;
    const { timelines: loaded } = await tetherApi.listTimelines(token);
    setTimelines(loaded);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        await loadTimelines();
      } catch (reason) {
        setError(userMessage(reason));
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn, loadTimelines]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getTokenRef.current();
      if (!token) return;
      try {
        const me = await tetherApi.me(token);
        setColors({
          mine: me.user.color ?? PARTNER_A,
          partner: me.relationship?.partner_color ?? PARTNER_B,
        });
      } catch {
        // Falls back to the default indigo/rose pairing — not worth failing the timeline over.
      }
    })();
  }, [isSignedIn]);

  // Landing side of a calendar deep link: jump straight to a milestone's timeline.
  const handledDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!params.openTimelineId || loading) return;
    const key = `${params.openTimelineId}:${params.openItemId ?? ''}`;
    if (handledDeepLinkRef.current === key) return;
    const target = timelines.find((entry) => entry.id === params.openTimelineId);
    if (!target) return;
    handledDeepLinkRef.current = key;
    setDetailTimeline(target);
    setAutoOpenItemId(params.openItemId ?? null);
  }, [params.openTimelineId, params.openItemId, timelines, loading]);

  const visibleTimelines = useMemo(() => {
    if (activeCategories.size === 0) return timelines;
    return timelines.filter((entry) => activeCategories.has(entry.category));
  }, [timelines, activeCategories]);

  function toggleCategory(category: TimelineCategory) {
    void Haptics.selectionAsync();
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function clearCategories() {
    void Haptics.selectionAsync();
    setActiveCategories(new Set());
  }

  function selectTimeline(timeline: Timeline) {
    void Haptics.selectionAsync();
    setAutoOpenItemId(null);
    setDetailTimeline(timeline);
  }

  function selectTimelineItem(timeline: Timeline, item: TimelineItem) {
    void Haptics.selectionAsync();
    setAutoOpenItemId(item.id);
    setDetailTimeline(timeline);
  }

  function handleSaved(timeline: Timeline) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimelines((prev) => {
      const exists = prev.some((entry) => entry.id === timeline.id);
      return exists ? prev.map((entry) => (entry.id === timeline.id ? timeline : entry)) : [...prev, timeline];
    });
    setCreateSheetOpen(false);
    setEditingTimeline(null);
  }

  function handleChanged(timeline: Timeline) {
    setTimelines((prev) => prev.map((entry) => (entry.id === timeline.id ? timeline : entry)));
    setDetailTimeline(timeline);
  }

  function handleDeleted(timelineId: string) {
    setTimelines((prev) => prev.filter((entry) => entry.id !== timelineId));
    setDetailTimeline(null);
  }

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View />
          <View style={styles.headerActions}>
            <Pressable onPress={() => setFilterMenuOpen((prev) => !prev)} style={styles.filterButton}>
              <Text style={styles.filterButtonText}>
                Filter{activeCategories.size > 0 ? ` · ${activeCategories.size}` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditingTimeline(null);
                setCreateSheetOpen(true);
              }}
              style={styles.fab}>
              <GlassCard style={styles.fabInner}><Text style={styles.fabIcon}>+</Text></GlassCard>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <TimelineSkeleton />
        ) : (
          <View style={styles.spaceWrap}>
            <TimelineSpace timelines={visibleTimelines} colors={colors} onSelect={selectTimeline} onSelectItem={selectTimelineItem} />
          </View>
        )}

        {error ? (
          <View style={styles.errorPill}><GlassCard style={styles.errorPillInner}><Text style={styles.errorText}>{error}</Text></GlassCard></View>
        ) : null}

        {filterMenuOpen ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterMenuOpen(false)} />
            <View style={styles.filterMenu}>
              <GlassCard style={styles.filterMenuInner}>
                <View style={styles.filterMenuHeader}>
                  <Text style={styles.filterMenuTitle}>Categories</Text>
                  {activeCategories.size > 0 ? (
                    <Pressable onPress={clearCategories} hitSlop={8}>
                      <Text style={styles.filterMenuClear}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
                <ScrollView style={styles.filterMenuList} showsVerticalScrollIndicator={false}>
                  {TIMELINE_CATEGORIES.map((entry) => {
                    const color = timelineCategoryColor(entry.value);
                    const active = activeCategories.has(entry.value);
                    return (
                      <Pressable key={entry.value} onPress={() => toggleCategory(entry.value)} style={styles.filterMenuRow}>
                        <View style={[styles.filterDot, { backgroundColor: color }]} />
                        <Text style={[styles.filterMenuRowText, active && styles.filterMenuRowTextActive]}>{entry.label}</Text>
                        {active ? <Text style={[styles.filterMenuCheck, { color }]}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </GlassCard>
            </View>
          </>
        ) : null}
      </SafeAreaView>

      <CreateTimelineSheet
        visible={createSheetOpen}
        token={tokenRef.current ?? ''}
        timelines={timelines}
        editingTimeline={editingTimeline}
        onClose={() => {
          setCreateSheetOpen(false);
          setEditingTimeline(null);
        }}
        onSaved={handleSaved}
      />

      <TimelineDetailSheet
        timeline={detailTimeline}
        token={tokenRef.current ?? ''}
        autoOpenItemId={autoOpenItemId}
        timelines={timelines}
        colors={colors}
        onClose={() => {
          setDetailTimeline(null);
          setAutoOpenItemId(null);
        }}
        onSelectTimeline={selectTimeline}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
        onEdit={(timeline) => {
          setDetailTimeline(null);
          setEditingTimeline(timeline);
          setCreateSheetOpen(true);
        }}
      />
    </Atmosphere>
  );
}

function TimelineSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={[styles.skeletonNode, key === 1 && styles.skeletonNodeOffset]}>
          <SkeletonCircle size={56} />
          <SkeletonBlock width={72} height={12} style={styles.skeletonLabel} />
          <SkeletonBlock width={44} height={10} style={styles.skeletonCaption} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, paddingHorizontal: 4 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  filterButton: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9 },
  filterButtonText: { color: '#C5C9D8', fontSize: 13, fontWeight: '600' },
  filterDot: { borderRadius: 4, height: 8, width: 8 },
  fab: { marginTop: 0 },
  fabInner: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', padding: 0, width: 40 },
  fabIcon: { color: '#F7F8FA', fontSize: 20, fontWeight: '700' },
  spaceWrap: { flex: 1 },
  filterMenu: { position: 'absolute', right: 4, top: 52, width: 232, zIndex: 20, elevation: 20 },
  filterMenuInner: { padding: 10 },
  filterMenuHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 6 },
  filterMenuTitle: { color: '#F7F8FA', fontSize: 13, fontWeight: '700' },
  filterMenuClear: { color: '#AEBBFF', fontSize: 12, fontWeight: '700' },
  filterMenuList: { maxHeight: 320 },
  filterMenuRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 6, paddingVertical: 10 },
  filterMenuRowText: { color: '#B8BBC5', flex: 1, fontSize: 14, fontWeight: '600' },
  filterMenuRowTextActive: { color: '#F7F8FA' },
  filterMenuCheck: { fontSize: 14, fontWeight: '800' },
  skeletonWrap: { alignItems: 'flex-end', flex: 1, flexDirection: 'row', gap: 40, justifyContent: 'center', paddingBottom: 120 },
  skeletonNode: { alignItems: 'center' },
  skeletonNodeOffset: { marginBottom: 64 },
  skeletonLabel: { marginTop: 10 },
  skeletonCaption: { marginTop: 6 },
  errorPill: { bottom: 24, left: 0, position: 'absolute', right: 0, alignItems: 'center' },
  errorPillInner: { paddingHorizontal: 16, paddingVertical: 10 },
  errorText: { color: '#FF9A9A', fontSize: 13, fontWeight: '600' },
});
