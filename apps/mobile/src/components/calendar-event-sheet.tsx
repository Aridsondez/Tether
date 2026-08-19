import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hexToRgba, PARTNER_A } from '@/components/atmosphere';
import { PlacePickerSheet } from '@/components/map/place-picker-sheet';
import {
  EVENT_CATEGORIES,
  EVENT_VISIBILITIES,
  RECURRENCE_FREQS,
  type CalendarEvent,
  type EventCategory,
  type EventDraft,
  type EventVisibility,
  type RecurrenceFreq,
} from '@/lib/api';
import { categoryColor } from '@/lib/calendar-colors';
import { calendarDateFromIso, formatDayLabel, formatTimeLabel, startOfDay } from '@/lib/date-utils';

type LinkedPlace = { id: string; name: string; category: string | null };

const VISIBILITY_COLORS: Record<EventVisibility, string> = {
  shared: PARTNER_A,
  private: '#8E93A1',
  summary_only: '#F4A261',
  hidden_until: '#FFD166',
};

type PickerKey = 'start' | 'end' | 'hidden_until' | 'recurrence_until' | null;

type CalendarEventSheetProps = {
  visible: boolean;
  event: CalendarEvent | null;
  initialStart?: Date;
  busy: boolean;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSave: (draft: EventDraft) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

export function CalendarEventSheet({ visible, event, initialStart, busy, getToken, onClose, onSave, onDelete }: CalendarEventSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  const [endDate, setEndDate] = useState<Date>(() => new Date(Date.now() + 60 * 60 * 1000));
  const [visibility, setVisibility] = useState<EventVisibility>('shared');
  const [hiddenUntil, setHiddenUntil] = useState<Date | null>(null);
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq>('none');
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKey>(null);
  const [linkedPlace, setLinkedPlace] = useState<LinkedPlace | null>(null);
  const [placePickerVisible, setPlacePickerVisible] = useState(false);
  const [placePickerToken, setPlacePickerToken] = useState('');

  useEffect(() => {
    if (!visible) return;
    setActivePicker(null);
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setLocation(event.location ?? '');
      setCategory((event.category as EventCategory) ?? 'other');
      setAllDay(event.all_day);
      setStartDate(event.all_day ? calendarDateFromIso(event.start_at) : new Date(event.start_at));
      setEndDate(event.all_day ? calendarDateFromIso(event.end_at) : new Date(event.end_at));
      setVisibility(event.visibility);
      setHiddenUntil(event.hidden_until ? new Date(event.hidden_until) : null);
      setRecurrenceFreq(event.recurrence_freq);
      setRecurrenceUntil(event.recurrence_until ? new Date(event.recurrence_until) : null);
      setLinkedPlace(event.place);
    } else {
      const start = initialStart ? new Date(initialStart) : new Date();
      setTitle('');
      setDescription('');
      setLocation('');
      setCategory('other');
      setAllDay(false);
      setStartDate(start);
      setEndDate(new Date(start.getTime() + 60 * 60 * 1000));
      setVisibility('shared');
      setHiddenUntil(null);
      setRecurrenceFreq('none');
      setRecurrenceUntil(null);
      setLinkedPlace(null);
    }
  }, [visible, event, initialStart]);

  async function openPlacePicker() {
    const token = await getToken();
    if (!token) return;
    setPlacePickerToken(token);
    setPlacePickerVisible(true);
  }

  function togglePicker(key: PickerKey) {
    setActivePicker((current) => (current === key ? null : key));
  }

  function onStartChange(pickerEvent: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (pickerEvent.type === 'dismissed' || !selected) return;
    const delta = selected.getTime() - startDate.getTime();
    setStartDate(selected);
    setEndDate(new Date(endDate.getTime() + delta));
  }

  function onEndChange(pickerEvent: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (pickerEvent.type === 'dismissed' || !selected) return;
    setEndDate(selected.getTime() < startDate.getTime() ? startDate : selected);
  }

  function onHiddenUntilChange(pickerEvent: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (pickerEvent.type === 'dismissed' || !selected) return;
    setHiddenUntil(selected);
  }

  function onRecurrenceUntilChange(pickerEvent: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (pickerEvent.type === 'dismissed' || !selected) return;
    setRecurrenceUntil(selected);
  }

  function toggleAllDay(next: boolean) {
    setAllDay(next);
    if (next) {
      setStartDate(startOfDay(startDate));
      setEndDate(startOfDay(endDate));
    }
  }

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Give it a title', 'Every event needs a name.');
      return;
    }
    if (visibility === 'hidden_until' && !hiddenUntil) {
      Alert.alert('Pick a reveal date', 'Surprise events need a date they’ll be revealed.');
      return;
    }

    const draft: EventDraft = {
      title: trimmedTitle,
      description: description.trim() || null,
      location: location.trim() || null,
      place_id: linkedPlace?.id ?? null,
      category,
      all_day: allDay,
      start_at: allDay ? startOfDay(startDate).toISOString() : startDate.toISOString(),
      end_at: allDay
        ? new Date(startOfDay(endDate).getTime() + 86_399_000).toISOString()
        : endDate.toISOString(),
      visibility,
      hidden_until: visibility === 'hidden_until' ? hiddenUntil?.toISOString() : null,
      recurrence_freq: recurrenceFreq,
      recurrence_until: recurrenceFreq !== 'none' && recurrenceUntil
        ? recurrenceUntil.toISOString().slice(0, 10)
        : null,
    };
    void onSave(draft);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert('Delete this event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void onDelete() },
    ]);
  }

  const selectedVisibility = EVENT_VISIBILITIES.find((entry) => entry.value === visibility);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.headerAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.headerTitle}>{event ? 'Edit event' : 'New event'}</Text>
              <Pressable onPress={handleSave} disabled={busy} hitSlop={12}>
                <Text style={[styles.headerAction, styles.headerSave, busy && styles.disabled]}>
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <TextInput
                placeholder="Title"
                placeholderTextColor="#8E93A1"
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.sectionLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {EVENT_CATEGORIES.map((entry) => (
                  <Chip
                    key={entry.value}
                    label={entry.label}
                    color={categoryColor(entry.value)}
                    selected={category === entry.value}
                    onPress={() => setCategory(entry.value)}
                  />
                ))}
              </ScrollView>

              <View style={styles.rowBetween}>
                <Text style={styles.fieldLabel}>All day</Text>
                <Switch value={allDay} onValueChange={toggleAllDay} trackColor={{ true: PARTNER_A }} />
              </View>

              <DateField
                label="Starts"
                date={startDate}
                allDay={allDay}
                active={activePicker === 'start'}
                onPress={() => togglePicker('start')}
              />
              {activePicker === 'start' && (
                <DateTimePicker
                  value={startDate}
                  mode={allDay ? 'date' : 'datetime'}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={onStartChange}
                />
              )}

              <DateField
                label="Ends"
                date={endDate}
                allDay={allDay}
                active={activePicker === 'end'}
                onPress={() => togglePicker('end')}
              />
              {activePicker === 'end' && (
                <DateTimePicker
                  value={endDate}
                  mode={allDay ? 'date' : 'datetime'}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={startDate}
                  onChange={onEndChange}
                />
              )}

              <Text style={styles.sectionLabel}>Repeats</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {RECURRENCE_FREQS.map((entry) => (
                  <Chip
                    key={entry.value}
                    label={entry.label}
                    color={PARTNER_A}
                    selected={recurrenceFreq === entry.value}
                    onPress={() => setRecurrenceFreq(entry.value)}
                  />
                ))}
              </ScrollView>
              {recurrenceFreq !== 'none' && (
                <>
                  <DateField
                    label="Ends repeating"
                    date={recurrenceUntil}
                    allDay
                    placeholder="Never"
                    active={activePicker === 'recurrence_until'}
                    onPress={() => togglePicker('recurrence_until')}
                    onClear={recurrenceUntil ? () => setRecurrenceUntil(null) : undefined}
                  />
                  {activePicker === 'recurrence_until' && (
                    <DateTimePicker
                      value={recurrenceUntil ?? startDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={startDate}
                      onChange={onRecurrenceUntilChange}
                    />
                  )}
                </>
              )}

              <TextInput
                placeholder="Location"
                placeholderTextColor="#8E93A1"
                style={styles.input}
                value={location}
                onChangeText={setLocation}
              />
              {linkedPlace ? (
                <View style={styles.linkedPlaceRow}>
                  <View style={styles.linkedPlaceDot} />
                  <Text style={styles.linkedPlaceText} numberOfLines={1}>Linked to {linkedPlace.name}</Text>
                  <Pressable onPress={() => setLinkedPlace(null)} hitSlop={10}>
                    <Text style={styles.linkedPlaceClear}>Unlink</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => void openPlacePicker()} style={styles.addFromPlacesButton}>
                  <Text style={styles.addFromPlacesText}>+ Add from saved places</Text>
                </Pressable>
              )}
              <TextInput
                placeholder="Notes"
                placeholderTextColor="#8E93A1"
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={styles.sectionLabel}>Who sees this</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {EVENT_VISIBILITIES.map((entry) => (
                  <Chip
                    key={entry.value}
                    label={entry.label}
                    color={VISIBILITY_COLORS[entry.value]}
                    selected={visibility === entry.value}
                    onPress={() => setVisibility(entry.value)}
                  />
                ))}
              </ScrollView>
              {selectedVisibility && <Text style={styles.visibilityCaption}>{selectedVisibility.description}</Text>}
              {visibility === 'hidden_until' && (
                <>
                  <DateField
                    label="Reveals on"
                    date={hiddenUntil}
                    allDay={false}
                    placeholder="Choose a date"
                    active={activePicker === 'hidden_until'}
                    onPress={() => togglePicker('hidden_until')}
                  />
                  {activePicker === 'hidden_until' && (
                    <DateTimePicker
                      value={hiddenUntil ?? startDate}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={onHiddenUntilChange}
                    />
                  )}
                </>
              )}

              {event && onDelete && (
                <Pressable onPress={confirmDelete} style={styles.deleteRow} disabled={busy}>
                  <Text style={styles.deleteText}>Delete event</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>

      <PlacePickerSheet
        visible={placePickerVisible}
        token={placePickerToken}
        onClose={() => setPlacePickerVisible(false)}
        onSelect={(place) => {
          setLinkedPlace({ id: place.id, name: place.name, category: place.category });
          setLocation(place.address ?? place.name);
          setPlacePickerVisible(false);
        }}
      />
    </Modal>
  );
}

function Chip({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? color : 'rgba(255,255,255,0.16)' },
        selected && { backgroundColor: hexToRgba(color, 0.18) },
      ]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, selected && { color: '#F7F8FA' }]}>{label}</Text>
    </Pressable>
  );
}

function DateField({
  label,
  date,
  allDay,
  active,
  placeholder,
  onPress,
  onClear,
}: {
  label: string;
  date: Date | null;
  allDay: boolean;
  active: boolean;
  placeholder?: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.dateRow, active && styles.dateRowActive]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <Text style={styles.dateValue}>
          {date ? (allDay ? formatDayLabel(date) : `${formatDayLabel(date)} · ${formatTimeLabel(date)}`) : placeholder ?? '—'}
        </Text>
        {onClear && (
          <Pressable onPress={onClear} hitSlop={10}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(4,5,8,0.6)', flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '92%' },
  sheet: { backgroundColor: '#14161C', borderColor: 'rgba(255,255,255,0.12)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 3, height: 5, marginBottom: 6, width: 40 },
  headerRow: { alignItems: 'center', borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 6 },
  headerTitle: { color: '#F7F8FA', fontSize: 16, fontWeight: '700' },
  headerAction: { color: '#C5C9D8', fontSize: 16, fontWeight: '600' },
  headerSave: { color: PARTNER_A, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  scrollContent: { gap: 14, paddingBottom: 36, paddingHorizontal: 20, paddingTop: 18 },
  titleInput: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', paddingVertical: 6 },
  sectionLabel: { color: '#8E93A1', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 6, textTransform: 'uppercase' },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { alignItems: 'center', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingVertical: 9 },
  chipDot: { borderRadius: 4, height: 8, width: 8 },
  chipText: { color: '#B8BBC5', fontSize: 13, fontWeight: '600' },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  fieldLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  dateRow: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 6, padding: 14 },
  dateRowActive: { borderColor: PARTNER_A },
  dateValueRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  dateValue: { color: '#AEB6FF', fontSize: 15, fontWeight: '600' },
  clearText: { color: '#8E93A1', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 15, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  addFromPlacesButton: { alignSelf: 'flex-start', marginTop: -6, paddingVertical: 6 },
  addFromPlacesText: { color: PARTNER_A, fontSize: 13, fontWeight: '700' },
  linkedPlaceRow: { alignItems: 'center', backgroundColor: 'rgba(108,140,255,0.12)', borderColor: 'rgba(108,140,255,0.32)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, marginTop: -6, paddingHorizontal: 12, paddingVertical: 10 },
  linkedPlaceDot: { backgroundColor: PARTNER_A, borderRadius: 4, height: 8, width: 8 },
  linkedPlaceText: { color: '#F7F8FA', flex: 1, fontSize: 13, fontWeight: '600' },
  linkedPlaceClear: { color: '#A9ADB7', fontSize: 12, fontWeight: '700' },
  visibilityCaption: { color: '#8E93A1', fontSize: 13, lineHeight: 18, marginTop: -6 },
  deleteRow: { alignItems: 'center', marginTop: 10, paddingVertical: 14 },
  deleteText: { color: '#FF9A9A', fontSize: 15, fontWeight: '700' },
});
