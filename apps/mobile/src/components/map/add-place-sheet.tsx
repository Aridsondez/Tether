import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A } from '@/components/atmosphere';
import {
  ApiError,
  PLACE_CATEGORIES,
  tetherApi,
  type Place,
  type PlaceCategory,
  type PlaceDraft,
  type PlaceSearchResult,
} from '@/lib/api';

type FormState = {
  name: string;
  category: PlaceCategory;
  address: string;
  notes: string;
  priceRange: number | null;
  latitude: number;
  longitude: number;
  photoReference: string | null;
  externalPlaceId: string | null;
};

function emptyForm(coordinate: { latitude: number; longitude: number }): FormState {
  return {
    name: '',
    category: 'other',
    address: '',
    notes: '',
    priceRange: null,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    photoReference: null,
    externalPlaceId: null,
  };
}

function formFromPlace(place: Place): FormState {
  return {
    name: place.name,
    category: place.category,
    address: place.address ?? '',
    notes: place.notes ?? '',
    priceRange: place.price_range,
    latitude: place.latitude,
    longitude: place.longitude,
    photoReference: place.photo_reference,
    externalPlaceId: place.external_place_id,
  };
}

type AddPlaceSheetProps = {
  visible: boolean;
  token: string;
  initialCoordinate: { latitude: number; longitude: number };
  editingPlace?: Place | null;
  onClose: () => void;
  onSaved: (place: Place) => void;
};

export function AddPlaceSheet({ visible, token, initialCoordinate, editingPlace, onClose, onSaved }: AddPlaceSheetProps) {
  const [step, setStep] = useState<'search' | 'form'>(editingPlace ? 'form' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<FormState>(editingPlace ? formFromPlace(editingPlace) : emptyForm(initialCoordinate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(editingPlace ? 'form' : 'search');
    setQuery('');
    setResults([]);
    setError(null);
    setForm(editingPlace ? formFromPlace(editingPlace) : emptyForm(initialCoordinate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingPlace?.id]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { results: found } = await tetherApi.searchPlaces(token, query.trim());
        setResults(found);
      } catch {
        // A failed search just leaves the list empty; the user can still add manually.
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [query, token]);

  async function pickResult(result: PlaceSearchResult) {
    setForm({
      name: result.name,
      category: result.suggested_category,
      address: result.address ?? '',
      notes: '',
      priceRange: result.price_level ? Math.min(Math.max(result.price_level, 1), 4) : null,
      latitude: result.latitude,
      longitude: result.longitude,
      photoReference: result.photo_reference,
      externalPlaceId: result.external_place_id,
    });
    setStep('form');
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Give this place a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const name = form.name.trim();
      const category = form.category;
      const address = form.address.trim() || null;
      const notes = form.notes.trim() || null;
      const saved = editingPlace
        ? await tetherApi.updatePlace(token, editingPlace.id, {
            name, category, address, notes, price_range: form.priceRange,
          })
        : await tetherApi.createPlace(token, {
            name, category, address, notes, price_range: form.priceRange,
            latitude: form.latitude, longitude: form.longitude,
            photo_reference: form.photoReference, external_place_id: form.externalPlaceId,
          } satisfies PlaceDraft);
      onSaved(saved.place);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not save this place. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Atmosphere>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>{editingPlace ? 'Edit place' : 'Save a place'}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
          </View>

          {step === 'search' ? (
            <View style={styles.searchStep}>
              <TextInput
                autoFocus
                placeholder="Search restaurants, bars, hotels…"
                placeholderTextColor="#8E93A1"
                style={styles.input}
                value={query}
                onChangeText={setQuery}
              />
              {searching ? <ActivityIndicator color="#F7F8FA" style={styles.searchSpinner} /> : null}
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.resultsList}>
                {results.map((result) => (
                  <Pressable key={result.external_place_id} onPress={() => void pickResult(result)}>
                    <GlassCard style={styles.resultCard}>
                      <Text style={styles.resultName} numberOfLines={1}>{result.name}</Text>
                      {result.address ? <Text style={styles.resultAddress} numberOfLines={1}>{result.address}</Text> : null}
                    </GlassCard>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setStep('form')} style={styles.manualLink}>
                <Text style={styles.manualLinkText}>Can&apos;t find it? Drop a pin manually</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Field label="Name">
                <TextInput
                  placeholder="Place name"
                  placeholderTextColor="#8E93A1"
                  style={styles.input}
                  value={form.name}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                />
              </Field>

              <Field label="Category">
                <View style={styles.chipRow}>
                  {PLACE_CATEGORIES.map(({ value, label }) => (
                    <Pressable key={value} onPress={() => setForm((prev) => ({ ...prev, category: value }))}>
                      <GlassCard style={[styles.chip, form.category === value && styles.chipActive]}>
                        <Text style={[styles.chipText, form.category === value && styles.chipTextActive]}>{label}</Text>
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Field label="Address">
                <TextInput
                  placeholder="Optional"
                  placeholderTextColor="#8E93A1"
                  style={styles.input}
                  value={form.address}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
                />
              </Field>

              <Field label="Price range">
                <View style={styles.chipRow}>
                  {[1, 2, 3, 4].map((level) => (
                    <Pressable key={level} onPress={() => setForm((prev) => ({ ...prev, priceRange: prev.priceRange === level ? null : level }))}>
                      <GlassCard style={[styles.chip, form.priceRange === level && styles.chipActive]}>
                        <Text style={[styles.chipText, form.priceRange === level && styles.chipTextActive]}>{'$'.repeat(level)}</Text>
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Field label="Notes">
                <TextInput
                  multiline
                  placeholder="What makes this place worth remembering?"
                  placeholderTextColor="#8E93A1"
                  style={[styles.input, styles.notesInput]}
                  value={form.notes}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                />
              </Field>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable disabled={busy} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, (pressed || busy) && styles.saveButtonMuted]}>
                <Text style={styles.saveButtonText}>{busy ? 'Saving…' : editingPlace ? 'Save changes' : 'Save place'}</Text>
              </Pressable>
            </ScrollView>
          )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  title: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  searchStep: { flex: 1, gap: 12, marginTop: 18 },
  searchSpinner: { marginTop: 8 },
  resultsList: { gap: 10, paddingBottom: 16 },
  resultCard: { gap: 2, padding: 14 },
  resultName: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  resultAddress: { color: '#A9ADB7', fontSize: 13 },
  manualLink: { alignItems: 'center', paddingVertical: 14 },
  manualLinkText: { color: PARTNER_A, fontSize: 14, fontWeight: '600' },
  form: { gap: 18, paddingBottom: 42, paddingTop: 18 },
  field: { gap: 8 },
  fieldLabel: { color: '#A9ADB7', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: 'rgba(5,6,9,0.34)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  notesInput: { minHeight: 90, paddingTop: 16, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: 'rgba(108,140,255,0.28)', borderColor: 'rgba(108,140,255,0.5)' },
  chipText: { color: '#DCE1FF', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#F7F8FA' },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  saveButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 18, justifyContent: 'center', minHeight: 56, paddingHorizontal: 20 },
  saveButtonMuted: { opacity: 0.58 },
  saveButtonText: { color: '#1B1E2B', fontSize: 16, fontWeight: '700' },
});
