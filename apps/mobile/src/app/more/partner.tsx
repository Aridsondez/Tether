import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B, hexToRgba, mixHex, shadeHex } from '@/components/atmosphere';
import {
  ApiError,
  PARTNER_NOTE_CATEGORIES,
  PREFERENCE_CATEGORIES,
  type PartnerNote,
  type PartnerNoteCategory,
  type Preference,
  tetherApi,
} from '@/lib/api';

function formatBirthday(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

const CATEGORY_ORDER: PartnerNoteCategory[] = ['want', 'like', 'mentioned', 'dont_want', 'dislike', 'note'];

const CATEGORY_ACCENT: Record<PartnerNoteCategory, string> = {
  want: PARTNER_A,
  like: shadeHex(PARTNER_A, 45),
  mentioned: mixHex(PARTNER_A, PARTNER_B),
  dont_want: PARTNER_B,
  dislike: shadeHex(PARTNER_B, -25),
  note: '#B8BBC5',
};

const CATEGORY_LABEL: Record<PartnerNoteCategory, string> = Object.fromEntries(
  PARTNER_NOTE_CATEGORIES.map((item) => [item.value, item.label]),
) as Record<PartnerNoteCategory, string>;

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PartnerNotesScreen() {
  const { getToken, isSignedIn } = useAuth();
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerBirthday, setPartnerBirthday] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<PartnerNote[]>([]);
  const [partnerPreferences, setPartnerPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ note: PartnerNote | null } | null>(null);

  // getToken's identity from useAuth() isn't stable across renders — depending
  // on it directly here would re-fire the load effect on every render and
  // hammer the API continuously instead of loading once per visit.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const reload = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const me = await tetherApi.me(token);
    const isActive = me.relationship?.relationship_status === 'active';
    setConnected(isActive);
    setPartnerName(me.relationship?.partner_display_name ?? null);
    setPartnerBirthday(me.relationship?.partner_birthday ?? null);
    if (!isActive) {
      setNotes([]);
      setPartnerPreferences([]);
      return;
    }
    const [{ notes: fetched }, { preferences }] = await Promise.all([
      tetherApi.listPartnerNotes(token),
      tetherApi.listPreferences(token),
    ]);
    setNotes(fetched);
    setPartnerPreferences(preferences.filter((item) => !item.is_mine));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    void reload()
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Could not load your notes.'))
      .finally(() => setLoading(false));
  }, [isSignedIn, reload]);

  async function removeNote(note: PartnerNote) {
    const token = await getToken();
    if (!token) return;
    try {
      await tetherApi.deletePartnerNote(token, note.id);
      setNotes((items) => items.filter((item) => item.id !== note.id));
    } catch (reason) {
      Alert.alert('Could not remove', reason instanceof ApiError ? reason.message : 'Please try again.');
    }
  }

  function confirmRemove(note: PartnerNote) {
    Alert.alert('Delete this note?', note.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeNote(note) },
    ]);
  }

  const sections = useMemo(
    () => CATEGORY_ORDER.map((category) => ({ category, items: notes.filter((note) => note.category === category) })).filter(
      (section) => section.items.length > 0,
    ),
    [notes],
  );

  const title = partnerName ? `About ${partnerName}` : 'About your partner';

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>Profile</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>What {partnerName ?? 'they'} shared, plus private notes only you can see.</Text>

        {loading ? (
          <ActivityIndicator color="#F7F8FA" size="large" style={styles.loading} />
        ) : connected === false ? (
          <GlassCard style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Connect with your partner first</Text>
            <Text style={styles.lockedCopy}>Once you&rsquo;re connected, you can start keeping notes about them here.</Text>
            <Pressable style={styles.lockedButton} onPress={() => router.push('/')}>
              <Text style={styles.lockedButtonText}>Go to Home</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <GlassCard style={styles.aboutCard}>
              <Text style={styles.aboutCardTitle}>{partnerName ?? 'Your partner'}</Text>
              {partnerBirthday ? (
                <Text style={styles.aboutCardMeta}>Birthday · {formatBirthday(partnerBirthday)}</Text>
              ) : null}

              {PREFERENCE_CATEGORIES.map((prefCategory) => {
                const items = partnerPreferences.filter((item) => item.category === prefCategory.value);
                if (items.length === 0) return null;
                return (
                  <View key={prefCategory.value} style={styles.aboutGroup}>
                    <Text style={styles.aboutGroupLabel}>{prefCategory.label.toUpperCase()}</Text>
                    <View style={styles.aboutChipRow}>
                      {items.map((item) => (
                        <View key={item.id} style={styles.aboutChip}>
                          <Text style={styles.aboutChipText}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              {!partnerBirthday && partnerPreferences.length === 0 ? (
                <Text style={styles.aboutEmpty}>
                  {partnerName ?? 'They'} haven&rsquo;t added a birthday or personalization yet.
                </Text>
              ) : null}
            </GlassCard>

            <Text style={styles.notesHeading}>Your private notes</Text>

            {sections.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyGlyph}>♡</Text>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyCopy}>Jot down what {partnerName ?? 'they'} wants, likes, or mentioned in passing — future you will thank you.</Text>
              </View>
            ) : (
              sections.map(({ category, items }) => (
                <View key={category} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: CATEGORY_ACCENT[category] }]} />
                    <Text style={styles.sectionLabel}>{CATEGORY_LABEL[category]}</Text>
                  </View>
                  {items.map((note) => (
                    <Pressable key={note.id} onPress={() => setComposer({ note })} onLongPress={() => confirmRemove(note)}>
                      <View style={[styles.noteCard, { borderLeftColor: CATEGORY_ACCENT[category] }]}>
                        <Text style={styles.noteBody}>{note.body}</Text>
                        <Text style={styles.noteTime}>{relativeTime(note.created_at)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        )}

        {connected ? (
          <Pressable style={styles.fab} onPress={() => setComposer({ note: null })} hitSlop={8}>
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      <NoteComposer
        visible={composer !== null}
        note={composer?.note ?? null}
        onClose={() => setComposer(null)}
        getToken={() => getTokenRef.current()}
        onSaved={(saved) => {
          setNotes((items) => {
            const exists = items.some((item) => item.id === saved.id);
            return exists ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items];
          });
          setComposer(null);
        }}
      />
    </Atmosphere>
  );
}

function NoteComposer({
  visible,
  note,
  onClose,
  getToken,
  onSaved,
}: {
  visible: boolean;
  note: PartnerNote | null;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  onSaved: (note: PartnerNote) => void;
}) {
  const [category, setCategory] = useState<PartnerNoteCategory>('note');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCategory(note?.category ?? 'note');
    setBody(note?.body ?? '');
    setError(null);
  }, [visible, note]);

  async function save() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Write something to remember.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      const result = note
        ? await tetherApi.updatePartnerNote(token, note.id, { category, body: trimmed })
        : await tetherApi.createPartnerNote(token, { category, body: trimmed });
      onSaved(result.note);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not save your note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.composerScreen}>
        <SafeAreaView style={styles.composerSafeArea} edges={['top', 'bottom']}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
              <Text style={styles.headerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{note ? 'Edit note' : 'New note'}</Text>
            <Pressable onPress={() => void save()} hitSlop={12} disabled={saving}>
              <Text style={[styles.headerAction, saving && styles.headerActionMuted]}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>

          <View style={styles.composerBody}>
            <View style={styles.categoryGrid}>
              {PARTNER_NOTE_CATEGORIES.map((item) => {
                const active = item.value === category;
                const accent = CATEGORY_ACCENT[item.value];
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setCategory(item.value)}
                    style={[styles.categoryChip, active && { backgroundColor: hexToRgba(accent, 0.2), borderColor: accent }]}>
                    <Text style={[styles.categoryChipText, active && { color: accent, fontWeight: '800' }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              autoFocus
              multiline
              placeholder="What do you want to remember?"
              placeholderTextColor="#8E93A1"
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  loading: { marginTop: 80 },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 6 },
  backChevron: { color: PARTNER_A, fontSize: 24, fontWeight: '700', marginTop: -2 },
  backLabel: { color: PARTNER_A, fontSize: 16, fontWeight: '600' },
  title: { color: '#F7F8FA', fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 10 },
  subtitle: { color: '#A9ADB7', fontSize: 14, lineHeight: 20, marginBottom: 18, marginTop: 4 },
  scrollContent: { gap: 22, paddingBottom: 120 },
  aboutCard: { gap: 12 },
  aboutCardTitle: { color: '#F7F8FA', fontSize: 18, fontWeight: '700' },
  aboutCardMeta: { color: '#B8BBC5', fontSize: 14, marginTop: -6 },
  aboutGroup: { gap: 8 },
  aboutGroupLabel: { color: '#8E93A1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  aboutChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aboutChip: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9 },
  aboutChipText: { color: '#F0F1F5', fontSize: 13, fontWeight: '600' },
  aboutEmpty: { color: '#8E93A1', fontSize: 13, lineHeight: 19 },
  notesHeading: { color: '#F7F8FA', fontSize: 15, fontWeight: '700', marginTop: 4 },
  section: { gap: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionDot: { borderRadius: 4, height: 8, width: 8 },
  sectionLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '700' },
  noteCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderLeftWidth: 3, borderRadius: 16, gap: 6, padding: 14,
  },
  noteBody: { color: '#F0F1F5', fontSize: 15, lineHeight: 21 },
  noteTime: { color: '#767C8A', fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyGlyph: { color: PARTNER_B, fontSize: 40 },
  emptyTitle: { color: '#F7F8FA', fontSize: 19, fontWeight: '700' },
  emptyCopy: { color: '#A9ADB7', fontSize: 14, lineHeight: 21, maxWidth: 280, textAlign: 'center' },
  lockedCard: { gap: 10, marginTop: 20 },
  lockedTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' },
  lockedCopy: { color: '#A9ADB7', fontSize: 14, lineHeight: 20 },
  lockedButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 16, marginTop: 4, paddingVertical: 13 },
  lockedButtonText: { color: '#1B1E2B', fontSize: 14, fontWeight: '700' },
  error: { color: '#FF9A9A', fontSize: 13, lineHeight: 18, marginTop: 4 },
  fab: {
    alignItems: 'center', backgroundColor: PARTNER_A, borderRadius: 30, bottom: 28, height: 58, justifyContent: 'center',
    position: 'absolute', right: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, width: 58,
  },
  fabText: { color: '#0B0C10', fontSize: 30, fontWeight: '700', marginTop: -2 },
  composerScreen: { backgroundColor: '#0B0C10', flex: 1 },
  composerSafeArea: { flex: 1 },
  headerRow: { alignItems: 'center', borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerCancel: { color: '#A9ADB7', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' },
  headerAction: { color: PARTNER_A, fontSize: 16, fontWeight: '700' },
  headerActionMuted: { opacity: 0.5 },
  composerBody: { gap: 18, paddingHorizontal: 20, paddingTop: 18 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderColor: 'rgba(255,255,255,0.15)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9 },
  categoryChipText: { color: '#B8BDC9', fontSize: 13, fontWeight: '600' },
  bodyInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    color: '#F7F8FA', fontSize: 16, lineHeight: 22, minHeight: 140, padding: 14, textAlignVertical: 'top',
  },
});
