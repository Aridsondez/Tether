import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, hexToRgba } from '@/components/atmosphere';
import {
  ApiError,
  TIMELINE_CATEGORIES,
  tetherApi,
  type Timeline,
  type TimelineItem,
  type TimelineItemDraft,
  type TimelineItemUpdateDraft,
} from '@/lib/api';

import { timelineCategoryColor, timelineColor, timelineProgress, type OwnerColors } from './timeline-color';
import { TimelineItemSheet } from './timeline-item-sheet';

function categoryLabel(category: Timeline['category']) {
  return TIMELINE_CATEGORIES.find((entry) => entry.value === category)?.label ?? 'Other';
}

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type TimelineDetailSheetProps = {
  timeline: Timeline | null;
  token: string;
  timelines: Timeline[];
  colors: OwnerColors;
  autoOpenItemId?: string | null;
  onClose: () => void;
  onChanged: (timeline: Timeline) => void;
  onDeleted: (timelineId: string) => void;
  onEdit: (timeline: Timeline) => void;
  onSelectTimeline: (timeline: Timeline) => void;
};

export function TimelineDetailSheet({
  timeline,
  token,
  timelines,
  colors,
  autoOpenItemId,
  onClose,
  onChanged,
  onDeleted,
  onEdit,
  onSelectTimeline,
}: TimelineDetailSheetProps) {
  const [itemSheet, setItemSheet] = useState<{ item: TimelineItem | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Landing side of the calendar deep link / graph milestone tap: jump straight to that item.
  useEffect(() => {
    if (!timeline || !autoOpenItemId) return;
    const target = timeline.items.find((entry) => entry.id === autoOpenItemId);
    if (target) setItemSheet({ item: target });
  }, [timeline, autoOpenItemId]);

  if (!timeline) return null;
  const color = timelineColor(timeline, colors);
  const categoryColor = timelineCategoryColor(timeline.category);
  const { completed, total, fraction } = timelineProgress(timeline);
  const ownerLabel = timeline.ownership === 'shared' ? 'Shared timeline' : timeline.created_by_you ? 'Your timeline' : `${timeline.created_by_name ?? 'Their'} timeline`;
  const parentTimelines = timeline.parent_timeline_ids
    .map((id) => timelines.find((entry) => entry.id === id))
    .filter((entry): entry is Timeline => Boolean(entry));

  async function toggleComplete(item: TimelineItem) {
    if (!timeline) return;
    setError(null);
    try {
      const { item: updated } = await tetherApi.updateTimelineItem(token, timeline.id, item.id, {
        completed: !item.completed_at,
      });
      onChanged({ ...timeline, items: timeline.items.map((entry) => (entry.id === updated.id ? updated : entry)) });
    } catch (reason) {
      setError(userMessage(reason));
    }
  }

  async function saveItem(draft: TimelineItemDraft | TimelineItemUpdateDraft) {
    if (!timeline) return;
    setError(null);

    if (itemSheet?.item) {
      setBusy(true);
      try {
        const { item: updated } = await tetherApi.updateTimelineItem(token, timeline.id, itemSheet.item.id, draft);
        onChanged({ ...timeline, items: timeline.items.map((entry) => (entry.id === updated.id ? updated : entry)) });
        setItemSheet(null);
      } catch (reason) {
        setError(userMessage(reason));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Optimistic create: the milestone appears instantly with a temporary id,
    // then gets swapped for the server row (or rolled back on failure).
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticItem: TimelineItem = {
      id: tempId,
      timeline_id: timeline.id,
      title: (draft as TimelineItemDraft).title,
      notes: draft.notes ?? null,
      target_date: draft.target_date ?? null,
      completed_at: null,
      position: timeline.items.length,
      created_at: new Date().toISOString(),
    };
    const withOptimistic = { ...timeline, items: [...timeline.items, optimisticItem] };
    onChanged(withOptimistic);
    setItemSheet(null);
    try {
      const { item: created } = await tetherApi.createTimelineItem(token, timeline.id, draft as TimelineItemDraft);
      onChanged({ ...withOptimistic, items: withOptimistic.items.map((entry) => (entry.id === tempId ? created : entry)) });
    } catch (reason) {
      onChanged({ ...withOptimistic, items: withOptimistic.items.filter((entry) => entry.id !== tempId) });
      setError(userMessage(reason));
    }
  }

  async function deleteItem(item: TimelineItem) {
    if (!timeline) return;
    // Optimistic delete: remove it from view immediately; put it back and
    // surface an error only if the request actually fails.
    const previousItems = timeline.items;
    setError(null);
    setItemSheet(null);
    onChanged({ ...timeline, items: previousItems.filter((entry) => entry.id !== item.id) });
    try {
      await tetherApi.deleteTimelineItem(token, timeline.id, item.id);
    } catch (reason) {
      onChanged({ ...timeline, items: previousItems });
      setError(userMessage(reason));
    }
  }

  function confirmDeleteTimeline() {
    if (!timeline) return;
    Alert.alert('Delete this timeline?', `"${timeline.title}" and all its milestones will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await tetherApi.deleteTimeline(token, timeline.id);
            onDeleted(timeline.id);
          } catch (reason) {
            setError(userMessage(reason));
          }
        },
      },
    ]);
  }

  return (
    <>
      <Modal visible={Boolean(timeline)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <Atmosphere>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={[styles.eyebrow, { color }]}>{ownerLabel.toUpperCase()}</Text>
                <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
              </View>

              <Text style={styles.title}>{timeline.title}</Text>
              <View style={[styles.categoryBadge, { borderColor: hexToRgba(categoryColor, 0.5), backgroundColor: hexToRgba(categoryColor, 0.16) }]}>
                <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>{categoryLabel(timeline.category)}</Text>
              </View>
              {timeline.description ? <Text style={styles.description}>{timeline.description}</Text> : null}

              {parentTimelines.length > 0 ? (
                <View style={styles.parentsRow}>
                  <Text style={styles.parentsLabel}>Merged from</Text>
                  <View style={styles.chipRow}>
                    {parentTimelines.map((parent) => (
                      <Pressable key={parent.id} onPress={() => onSelectTimeline(parent)}>
                        <GlassCard style={styles.parentChip}>
                          <Text numberOfLines={1} style={styles.parentChipText}>{parent.title}</Text>
                        </GlassCard>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <GlassCard style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={[styles.progressBadge, { color }]}>{total > 0 ? `${Math.round(fraction * 100)}%` : '—'}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.progressCaption}>
                  {total > 0 ? `${completed} of ${total} milestones complete` : 'No milestones yet'}
                </Text>
              </GlassCard>

              <View style={styles.itemsHeader}>
                <Text style={styles.sectionLabel}>Milestones</Text>
                <Pressable onPress={() => setItemSheet({ item: null })} hitSlop={8}>
                  <Text style={[styles.addLink, { color }]}>+ Add</Text>
                </Pressable>
              </View>

              {timeline.items.length === 0 ? (
                <Text style={styles.emptyItems}>No milestones yet. Add one to start plotting progress.</Text>
              ) : (
                <View>
                  {timeline.items.map((item, index) => {
                    const prevDone = index > 0 ? Boolean(timeline.items[index - 1].completed_at) : true;
                    const done = Boolean(item.completed_at);
                    return (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={styles.rail}>
                          {index > 0 ? (
                            <View style={[styles.railSegment, { backgroundColor: prevDone ? color : 'rgba(255,255,255,0.14)' }]} />
                          ) : null}
                          <Pressable onPress={() => void toggleComplete(item)} hitSlop={8} style={[styles.dot, { borderColor: color }, done && { backgroundColor: color }]} />
                        </View>
                        <Pressable style={styles.itemContent} onPress={() => setItemSheet({ item })}>
                          <Text style={[styles.itemTitle, done && styles.itemTitleDone]}>{item.title}</Text>
                          <Text style={styles.itemMeta}>
                            {item.target_date ? formatDate(item.target_date) : done ? 'Approved' : 'No date · tap to edit'}
                          </Text>
                          {item.notes ? <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text> : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.footerActions}>
                <Pressable onPress={() => onEdit(timeline)} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit timeline</Text>
                </Pressable>
                <Pressable onPress={confirmDeleteTimeline} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Delete timeline</Text>
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>

          <TimelineItemSheet
            visible={Boolean(itemSheet)}
            color={color}
            editingItem={itemSheet?.item}
            busy={busy}
            error={error}
            onClose={() => setItemSheet(null)}
            onSave={(draft) => void saveItem(draft)}
            onDelete={(item) => void deleteItem(item)}
          />
        </Atmosphere>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  content: { gap: 16, paddingBottom: 48, paddingTop: 10 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  title: { color: '#F7F8FA', fontSize: 27, fontWeight: '700', letterSpacing: -0.6 },
  categoryBadge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 6, marginTop: 2, paddingHorizontal: 11, paddingVertical: 5 },
  categoryDot: { borderRadius: 4, height: 7, width: 7 },
  categoryBadgeText: { fontSize: 12, fontWeight: '700' },
  description: { color: '#B8BBC5', fontSize: 15, lineHeight: 22 },
  parentsRow: { gap: 8 },
  parentsLabel: { color: '#A9ADB7', fontSize: 12, fontWeight: '600' },
  parentChip: { borderRadius: 100, maxWidth: 200, paddingHorizontal: 13, paddingVertical: 7 },
  parentChipText: { color: '#DCE1FF', fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progressCard: { gap: 10 },
  progressHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  progressBadge: { fontSize: 15, fontWeight: '700' },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, height: 8, overflow: 'hidden' },
  progressFill: { borderRadius: 5, height: '100%' },
  progressCaption: { color: '#A9ADB7', fontSize: 12 },
  itemsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  addLink: { fontSize: 14, fontWeight: '700' },
  emptyItems: { color: '#8E93A1', fontSize: 14, lineHeight: 20 },
  itemRow: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 20 },
  railSegment: { height: 24, width: 2 },
  dot: { backgroundColor: 'transparent', borderRadius: 9, borderWidth: 2.5, height: 18, width: 18 },
  itemContent: { flex: 1, gap: 3, paddingBottom: 18 },
  itemTitle: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  itemTitleDone: { color: '#A9ADB7', textDecorationLine: 'line-through' },
  itemMeta: { color: '#8E93A1', fontSize: 12 },
  itemNotes: { color: '#B8BBC5', fontSize: 13, lineHeight: 18, marginTop: 2 },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  footerActions: { gap: 4, marginTop: 8 },
  editButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 18, justifyContent: 'center', minHeight: 54 },
  editButtonText: { color: '#1B1E2B', fontSize: 15, fontWeight: '700' },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  deleteButtonText: { color: '#FFAAA8', fontSize: 14, fontWeight: '700' },
});
