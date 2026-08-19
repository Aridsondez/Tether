import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, hexToRgba } from '@/components/atmosphere';
import type { TimelineItem, TimelineItemDraft, TimelineItemUpdateDraft } from '@/lib/api';

function toDateOnly(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type TimelineItemSheetProps = {
  visible: boolean;
  color: string;
  editingItem?: TimelineItem | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: TimelineItemDraft | TimelineItemUpdateDraft) => void;
  onDelete?: (item: TimelineItem) => void;
};

export function TimelineItemSheet({ visible, color, editingItem, busy, error, onClose, onSave, onDelete }: TimelineItemSheetProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [hasDate, setHasDate] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(editingItem?.title ?? '');
    setNotes(editingItem?.notes ?? '');
    setHasDate(Boolean(editingItem?.target_date));
    setDate(editingItem?.target_date ? new Date(`${editingItem.target_date}T00:00:00`) : new Date());
    setShowPicker(false);
    setLocalError(null);
  }, [visible, editingItem?.id, editingItem?.notes, editingItem?.target_date, editingItem?.title]);

  function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Give this milestone a title.');
      return;
    }
    setLocalError(null);
    onSave({
      title: trimmed,
      notes: notes.trim() || null,
      target_date: hasDate ? toDateOnly(date) : null,
    });
  }

  function confirmDelete() {
    if (!editingItem || !onDelete) return;
    Alert.alert('Remove this milestone?', `"${editingItem.title}" will be removed from the timeline.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(editingItem) },
    ]);
  }

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Atmosphere>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>{editingItem ? 'Edit milestone' : 'Add milestone'}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field label="Title">
              <TextInput
                autoFocus={!editingItem}
                placeholder="What's the milestone?"
                placeholderTextColor="#8E93A1"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
              />
            </Field>

            <Field label="Notes">
              <TextInput
                multiline
                placeholder="Optional details"
                placeholderTextColor="#8E93A1"
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
              />
            </Field>

            <Field label="When">
              <View style={styles.chipRow}>
                <Pressable onPress={() => setHasDate(false)}>
                  <GlassCard style={[styles.chip, !hasDate && { backgroundColor: hexToRgba(color, 0.28), borderColor: hexToRgba(color, 0.5) }]}>
                    <Text style={[styles.chipText, !hasDate && styles.chipTextActive]}>Manually approve</Text>
                  </GlassCard>
                </Pressable>
                <Pressable onPress={() => { setHasDate(true); setShowPicker(true); }}>
                  <GlassCard style={[styles.chip, hasDate && { backgroundColor: hexToRgba(color, 0.28), borderColor: hexToRgba(color, 0.5) }]}>
                    <Text style={[styles.chipText, hasDate && styles.chipTextActive]}>Set a date</Text>
                  </GlassCard>
                </Pressable>
              </View>
              {hasDate ? (
                <Pressable onPress={() => setShowPicker(true)} style={styles.dateValue}>
                  <Text style={[styles.dateValueText, { color }]}>{formatDisplayDate(toDateOnly(date))}</Text>
                </Pressable>
              ) : (
                <Text style={styles.hint}>No date — you mark this done yourself, whenever it happens.</Text>
              )}
              {showPicker && hasDate ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_event, selected) => {
                    if (Platform.OS !== 'ios') setShowPicker(false);
                    if (selected) setDate(selected);
                  }}
                  themeVariant="dark"
                />
              ) : null}
            </Field>

            {(localError ?? error) ? <Text style={styles.error}>{localError ?? error}</Text> : null}

            <Pressable disabled={busy} onPress={save} style={({ pressed }) => [styles.saveButton, { backgroundColor: color }, (pressed || busy) && styles.saveButtonMuted]}>
              <Text style={styles.saveButtonText}>{busy ? 'Saving…' : editingItem ? 'Save changes' : 'Add milestone'}</Text>
            </Pressable>

            {editingItem && onDelete ? (
              <Pressable disabled={busy} onPress={confirmDelete} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Remove milestone</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Atmosphere>
    </View>
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

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 20, zIndex: 20 },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  title: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  form: { gap: 18, paddingBottom: 42, paddingTop: 18 },
  field: { gap: 8 },
  fieldLabel: { color: '#A9ADB7', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: 'rgba(5,6,9,0.34)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  notesInput: { minHeight: 80, paddingTop: 16, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: '#DCE1FF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#F7F8FA' },
  dateValue: { marginTop: 10 },
  dateValueText: { fontSize: 15, fontWeight: '700' },
  hint: { color: '#8E93A1', fontSize: 12, lineHeight: 17, marginTop: 8 },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  saveButton: { alignItems: 'center', borderRadius: 18, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  saveButtonMuted: { opacity: 0.58 },
  saveButtonText: { color: '#111318', fontSize: 16, fontWeight: '700' },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  deleteButtonText: { color: '#FFAAA8', fontSize: 14, fontWeight: '700' },
});
