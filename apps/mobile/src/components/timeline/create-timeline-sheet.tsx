import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, hexToRgba } from '@/components/atmosphere';
import {
  ApiError,
  TIMELINE_CATEGORIES,
  TIMELINE_MAX_PARENTS,
  TIMELINE_OWNERSHIPS,
  tetherApi,
  type Timeline,
  type TimelineCategory,
  type TimelineOwnership,
} from '@/lib/api';

import { timelineCategoryColor } from './timeline-color';

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

type CreateTimelineSheetProps = {
  visible: boolean;
  token: string;
  timelines: Timeline[];
  editingTimeline?: Timeline | null;
  onClose: () => void;
  onSaved: (timeline: Timeline) => void;
};

export function CreateTimelineSheet({ visible, token, timelines, editingTimeline, onClose, onSaved }: CreateTimelineSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownership, setOwnership] = useState<TimelineOwnership>('shared');
  const [category, setCategory] = useState<TimelineCategory>('other');
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchCategoryFilter, setBranchCategoryFilter] = useState<TimelineCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(editingTimeline?.title ?? '');
    setDescription(editingTimeline?.description ?? '');
    setOwnership(editingTimeline?.ownership ?? 'shared');
    setCategory(editingTimeline?.category ?? 'other');
    setParentIds(editingTimeline?.parent_timeline_ids ?? []);
    setBranchSearch('');
    setBranchCategoryFilter(null);
    setError(null);
  }, [
    visible,
    editingTimeline?.id,
    editingTimeline?.title,
    editingTimeline?.description,
    editingTimeline?.ownership,
    editingTimeline?.category,
    editingTimeline?.parent_timeline_ids,
  ]);

  const branchOptions = useMemo(() => {
    const query = branchSearch.trim().toLowerCase();
    return timelines.filter((entry) => {
      if (entry.id === editingTimeline?.id) return false;
      if (branchCategoryFilter && entry.category !== branchCategoryFilter) return false;
      if (query && !entry.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [timelines, editingTimeline?.id, branchSearch, branchCategoryFilter]);

  const selectedParents = parentIds
    .map((id) => timelines.find((entry) => entry.id === id))
    .filter((entry): entry is Timeline => Boolean(entry));

  function toggleParent(id: string) {
    setParentIds((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id);
      if (prev.length >= TIMELINE_MAX_PARENTS) {
        setError(`Up to ${TIMELINE_MAX_PARENTS} timelines can merge here — remove one first.`);
        return prev;
      }
      setError(null);
      return [...prev, id];
    });
  }

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Give this timeline a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = editingTimeline
        ? await tetherApi.updateTimeline(token, editingTimeline.id, {
            title: trimmedTitle,
            description: description.trim() || null,
            category,
            parent_timeline_ids: parentIds,
          })
        : await tetherApi.createTimeline(token, {
            title: trimmedTitle,
            description: description.trim() || null,
            ownership,
            category,
            parent_timeline_ids: parentIds,
          });
      onSaved(saved.timeline);
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Atmosphere>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>{editingTimeline ? 'Edit timeline' : 'New timeline'}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field label="Title">
              <TextInput
                autoFocus
                placeholder="What's this tracking?"
                placeholderTextColor="#8E93A1"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />
            </Field>

            <Field label="Description">
              <TextInput
                multiline
                placeholder="Optional — what's this timeline for?"
                placeholderTextColor="#8E93A1"
                style={[styles.input, styles.notesInput]}
                value={description}
                onChangeText={setDescription}
              />
            </Field>

            <Field label="Category">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotChipRow}>
                {TIMELINE_CATEGORIES.map((entry) => (
                  <DotChip
                    key={entry.value}
                    label={entry.label}
                    color={timelineCategoryColor(entry.value)}
                    selected={category === entry.value}
                    onPress={() => setCategory(entry.value)}
                  />
                ))}
              </ScrollView>
            </Field>

            {!editingTimeline ? (
              <Field label="Whose timeline is this?">
                <View style={styles.chipRow}>
                  {TIMELINE_OWNERSHIPS.map(({ value, label }) => (
                    <Pressable key={value} onPress={() => setOwnership(value)}>
                      <GlassCard style={[styles.chip, ownership === value && styles.chipActive]}>
                        <Text style={[styles.chipText, ownership === value && styles.chipTextActive]}>{label}</Text>
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
              </Field>
            ) : null}

            {timelines.length > 0 ? (
              <Field label="Branch from">
                {selectedParents.length > 0 ? (
                  <View style={styles.chipRow}>
                    {selectedParents.map((entry) => (
                      <Pressable key={entry.id} onPress={() => toggleParent(entry.id)}>
                        <GlassCard style={[styles.chip, styles.chipActive]}>
                          <Text style={[styles.chipText, styles.chipTextActive]} numberOfLines={1}>{entry.title} ✕</Text>
                        </GlassCard>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hint}>No parents yet — this timeline will start as its own root.</Text>
                )}

                <TextInput
                  placeholder="Search timelines…"
                  placeholderTextColor="#8E93A1"
                  style={[styles.input, styles.searchInput]}
                  value={branchSearch}
                  onChangeText={setBranchSearch}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotChipRow}>
                  <DotChip
                    label="All"
                    color="#9AA0A8"
                    selected={branchCategoryFilter === null}
                    onPress={() => setBranchCategoryFilter(null)}
                  />
                  {TIMELINE_CATEGORIES.map((entry) => (
                    <DotChip
                      key={entry.value}
                      label={entry.label}
                      color={timelineCategoryColor(entry.value)}
                      selected={branchCategoryFilter === entry.value}
                      onPress={() => setBranchCategoryFilter(entry.value)}
                    />
                  ))}
                </ScrollView>

                {branchOptions.length === 0 ? (
                  <Text style={styles.hint}>No timelines match that search.</Text>
                ) : (
                  <View style={styles.chipRow}>
                    {branchOptions.map((entry) => {
                      const selected = parentIds.includes(entry.id);
                      return (
                        <Pressable key={entry.id} onPress={() => toggleParent(entry.id)}>
                          <GlassCard style={[styles.chip, selected && styles.chipActive]}>
                            <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextActive]}>{entry.title}</Text>
                          </GlassCard>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Text style={styles.hint}>Pick up to {TIMELINE_MAX_PARENTS} — picking two merges them into this one goal.</Text>
              </Field>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable disabled={busy} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, (pressed || busy) && styles.saveButtonMuted]}>
              <Text style={styles.saveButtonText}>{busy ? 'Saving…' : editingTimeline ? 'Save changes' : 'Create timeline'}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Atmosphere>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function DotChip({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dotChip,
        { borderColor: selected ? color : 'rgba(255,255,255,0.16)' },
        selected && { backgroundColor: hexToRgba(color, 0.18) },
      ]}>
      <View style={[styles.dotChipDot, { backgroundColor: color }]} />
      <Text style={[styles.dotChipText, selected && styles.dotChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  title: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  form: { gap: 18, paddingBottom: 42, paddingTop: 18 },
  field: { gap: 8 },
  fieldLabel: { color: '#A9ADB7', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: 'rgba(5,6,9,0.34)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  notesInput: { minHeight: 90, paddingTop: 16, textAlignVertical: 'top' },
  searchInput: { minHeight: 48, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 100, maxWidth: 220, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: hexToRgba(PARTNER_A, 0.28), borderColor: hexToRgba(PARTNER_A, 0.5) },
  chipText: { color: '#DCE1FF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#F7F8FA' },
  dotChipRow: { gap: 8, paddingRight: 8 },
  dotChip: { alignItems: 'center', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  dotChipDot: { borderRadius: 4, height: 8, width: 8 },
  dotChipText: { color: '#B8BBC5', fontSize: 12, fontWeight: '600' },
  dotChipTextActive: { color: '#F7F8FA' },
  hint: { color: '#8E93A1', fontSize: 12, lineHeight: 17, marginTop: 4 },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  saveButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 18, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  saveButtonMuted: { opacity: 0.58 },
  saveButtonText: { color: '#1B1E2B', fontSize: 16, fontWeight: '700' },
});
