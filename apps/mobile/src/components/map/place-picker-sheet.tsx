import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { PLACE_CATEGORIES, tetherApi, type Place } from '@/lib/api';

function categoryLabel(category: Place['category']) {
  return PLACE_CATEGORIES.find((entry) => entry.value === category)?.label ?? 'Place';
}

type PlacePickerSheetProps = {
  visible: boolean;
  token: string;
  onClose: () => void;
  onSelect: (place: Place) => void;
};

export function PlacePickerSheet({ visible, token, onClose, onSelect }: PlacePickerSheetProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible || !token) return;
    setQuery('');
    setError(null);
    setLoading(true);
    tetherApi
      .listPlaces(token)
      .then(({ places: loaded }) => setPlaces(loaded))
      .catch(() => setError('Could not load your saved places.'))
      .finally(() => setLoading(false));
  }, [visible, token]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return places;
    return places.filter((place) =>
      place.name.toLowerCase().includes(needle) || (place.address ?? '').toLowerCase().includes(needle),
    );
  }, [places, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Atmosphere>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>Saved places</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          <TextInput
            autoFocus
            placeholder="Search your saved places…"
            placeholderTextColor="#8E93A1"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
          />

          {loading ? (
            <ActivityIndicator color="#F7F8FA" style={styles.spinner} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : results.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {places.length === 0 ? "You haven't saved any places yet — add one from the Map tab." : 'No matches.'}
              </Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {results.map((place) => {
                const ownerColor = place.created_by_you ? PARTNER_A : PARTNER_B;
                return (
                  <Pressable key={place.id} onPress={() => onSelect(place)}>
                    <GlassCard style={styles.row}>
                      <View style={[styles.dot, { backgroundColor: ownerColor }]} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowName} numberOfLines={1}>{place.name}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {categoryLabel(place.category)}{place.address ? ` · ${place.address}` : ''}
                        </Text>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Atmosphere>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  title: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  input: { backgroundColor: 'rgba(5,6,9,0.34)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, marginTop: 16, minHeight: 54, paddingHorizontal: 16 },
  spinner: { marginTop: 24 },
  error: { color: '#FF9A9A', fontSize: 14, marginTop: 24, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: '#A9ADB7', fontSize: 14, lineHeight: 20, paddingHorizontal: 20, textAlign: 'center' },
  list: { gap: 10, paddingBottom: 32, paddingTop: 16 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 },
  dot: { borderRadius: 6, height: 12, width: 12 },
  rowText: { flex: 1, gap: 2 },
  rowName: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: '#A9ADB7', fontSize: 13 },
});
