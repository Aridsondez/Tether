import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, PARTNER_A, PARTNER_B, hexToRgba, mixHex } from '@/components/atmosphere';
import { ApiError, PREFERENCE_CATEGORIES, type Preference, type PreferenceCategory, tetherApi } from '@/lib/api';

const ACCENTS: Record<PreferenceCategory, string> = {
  like: PARTNER_A,
  dislike: PARTNER_B,
  gift_idea: mixHex(PARTNER_A, PARTNER_B),
};

const HINTS: Record<PreferenceCategory, string> = {
  like: 'Things that make you, you.',
  dislike: 'Foods, habits, whatever — good to know.',
  gift_idea: 'Drop hints for your partner to find.',
};

const SEGMENT_WIDTH = 110;

export default function PersonalizationScreen() {
  const { getToken, isSignedIn } = useAuth();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [category, setCategory] = useState<PreferenceCategory>('like');
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const indicator = useRef(new Animated.Value(0)).current;

  // getToken's identity from useAuth() isn't stable across renders — depending
  // on it directly here would re-fire the load effect on every render.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const reload = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const [preferencesResponse, me] = await Promise.all([tetherApi.listPreferences(token), tetherApi.me(token)]);
    setPreferences(preferencesResponse.preferences);
    setPartnerName(me.relationship?.partner_display_name ?? null);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    void reload();
  }, [isSignedIn, reload]);

  function selectCategory(next: PreferenceCategory, index: number) {
    setCategory(next);
    setShowAdd(false);
    setLabel('');
    Animated.spring(indicator, { toValue: index * SEGMENT_WIDTH, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }

  async function addItem() {
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.createPreference(token, { category, label: trimmed });
      setLabel('');
      setShowAdd(false);
      await reload();
    } catch (reason) {
      Alert.alert('Could not add', reason instanceof ApiError ? reason.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: Preference) {
    setRemovingId(item.id);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.deletePreference(token, item.id);
      await reload();
    } catch (reason) {
      Alert.alert('Could not remove', reason instanceof ApiError ? reason.message : 'Please try again.');
    } finally {
      setRemovingId(null);
    }
  }

  const accent = ACCENTS[category];
  const items = preferences.filter((item) => item.category === category);
  const mine = items.filter((item) => item.is_mine);
  const theirs = items.filter((item) => !item.is_mine);

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
          <Text style={[styles.backChevron, { color: accent }]}>‹</Text>
          <Text style={[styles.backLabel, { color: accent }]}>Profile</Text>
        </Pressable>
        <Text style={styles.title}>Personalization</Text>
        <Text style={styles.subtitle}>{HINTS[category]}</Text>

        <View style={styles.segmentTrack}>
          <Animated.View style={[styles.segmentIndicator, { backgroundColor: hexToRgba(accent, 0.22), transform: [{ translateX: indicator }] }]} />
          {PREFERENCE_CATEGORIES.map((item, index) => {
            const active = item.value === category;
            return (
              <Pressable key={item.value} onPress={() => selectCategory(item.value, index)} style={styles.segment}>
                <Text style={[styles.segmentText, active && { color: ACCENTS[item.value], fontWeight: '800' }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <GroupLabel label="Yours" accent={accent} />
          <View style={styles.chipGrid}>
            {mine.map((item) => (
              <View key={item.id} style={[styles.chip, { backgroundColor: hexToRgba(accent, 0.14), borderColor: hexToRgba(accent, 0.4) }]}>
                <Text style={[styles.chipText, { color: '#F7F8FA' }]}>{item.label}</Text>
                <Pressable onPress={() => void removeItem(item)} hitSlop={8} disabled={removingId === item.id}>
                  <Text style={styles.chipRemove}>{removingId === item.id ? '…' : '×'}</Text>
                </Pressable>
              </View>
            ))}
            {!showAdd ? (
              <Pressable onPress={() => setShowAdd(true)} style={[styles.chip, styles.addChip, { borderColor: hexToRgba(accent, 0.55) }]}>
                <Text style={[styles.chipText, { color: accent }]}>+ Add</Text>
              </Pressable>
            ) : null}
          </View>

          {showAdd ? (
            <View style={styles.addRow}>
              <TextInput
                autoFocus
                placeholder="Type here…"
                placeholderTextColor="#8E93A1"
                style={styles.addInput}
                value={label}
                onChangeText={setLabel}
                onSubmitEditing={() => void addItem()}
                returnKeyType="done"
              />
              <Pressable onPress={() => void addItem()} disabled={busy || !label.trim()} hitSlop={8}>
                <Text style={[styles.addSubmit, { color: accent }, (busy || !label.trim()) && styles.addSubmitMuted]}>
                  {busy ? 'Adding…' : 'Add'}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setShowAdd(false); setLabel(''); }} hitSlop={8} disabled={busy}>
                <Text style={styles.addCancel}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          {mine.length === 0 && !showAdd ? <Text style={styles.empty}>Nothing yet — tap + Add to start.</Text> : null}

          {theirs.length > 0 ? (
            <>
              <GroupLabel label={partnerName ?? 'Your partner'} accent={accent} style={styles.partnerLabel} />
              <View style={styles.chipGrid}>
                {theirs.map((item) => (
                  <View key={item.id} style={styles.partnerChip}>
                    <Text style={styles.partnerChipText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Atmosphere>
  );
}

function GroupLabel({ label, accent, style }: { label: string; accent: string; style?: object }) {
  return (
    <View style={[styles.groupLabelRow, style]}>
      <View style={[styles.groupDot, { backgroundColor: accent }]} />
      <Text style={styles.groupLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  title: { color: '#F7F8FA', fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 10 },
  subtitle: { color: '#A9ADB7', fontSize: 15, lineHeight: 21, marginBottom: 18, marginTop: 4 },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 6 },
  backChevron: { fontSize: 24, fontWeight: '700', marginTop: -2 },
  backLabel: { fontSize: 16, fontWeight: '600' },
  segmentTrack: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', marginBottom: 20, overflow: 'hidden', padding: 4,
  },
  segmentIndicator: { borderRadius: 14, bottom: 4, left: 4, position: 'absolute', top: 4, width: SEGMENT_WIDTH - 8 },
  segment: { alignItems: 'center', justifyContent: 'center', width: SEGMENT_WIDTH },
  segmentText: { color: '#A9ADB7', fontSize: 13, fontWeight: '600' },
  scrollContent: { gap: 10, paddingBottom: 40 },
  groupLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  partnerLabel: { marginTop: 22 },
  groupDot: { borderRadius: 3, height: 6, width: 6 },
  groupLabel: { color: '#8E93A1', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { alignItems: 'center', borderRadius: 100, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 48, paddingHorizontal: 18, paddingVertical: 15 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipRemove: { color: '#B8BBC5', fontSize: 16, fontWeight: '700' },
  addChip: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  addRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 4 },
  addInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', flex: 1, fontSize: 14, minHeight: 44, paddingHorizontal: 12 },
  addSubmit: { fontSize: 14, fontWeight: '700' },
  addSubmitMuted: { opacity: 0.4 },
  addCancel: { color: '#8E93A1', fontSize: 13, fontWeight: '600' },
  empty: { color: '#8E93A1', fontSize: 13, lineHeight: 19, marginTop: 2 },
  partnerChip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18, paddingVertical: 15 },
  partnerChipText: { color: '#B8BBC5', fontSize: 14, fontWeight: '600' },
});
