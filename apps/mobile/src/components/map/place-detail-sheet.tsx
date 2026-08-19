import { Image } from 'expo-image';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { PLACE_CATEGORIES, tetherApi, type Place } from '@/lib/api';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function categoryLabel(category: Place['category']) {
  return PLACE_CATEGORIES.find((entry) => entry.value === category)?.label ?? 'Place';
}

type PlaceDetailSheetProps = {
  place: Place | null;
  token: string;
  busy: boolean;
  myColor?: string;
  partnerColor?: string;
  onClose: () => void;
  onToggleLike: (place: Place) => void;
  onToggleVisited: (place: Place) => void;
  onRate: (place: Place, rating: number | null) => void;
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => void;
};

export function PlaceDetailSheet({
  place, token, busy, myColor = PARTNER_A, partnerColor = PARTNER_B, onClose, onToggleLike, onToggleVisited, onRate, onEdit, onDelete,
}: PlaceDetailSheetProps) {
  if (!place) return null;
  const ownerColor = place.created_by_you ? myColor : partnerColor;
  const ownerLabel = place.created_by_you ? 'You' : (place.created_by_name ?? 'Your partner');
  const bothLike = place.liked_by_you && place.liked_by_partner;

  function confirmDelete() {
    Alert.alert('Remove this place?', `"${place!.name}" will be removed for both of you.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(place!) },
    ]);
  }

  return (
    <Modal visible={Boolean(place)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Atmosphere>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{categoryLabel(place.category).toUpperCase()}</Text>
              <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
            </View>

            {place.photo_reference ? (
              <Image
                source={tetherApi.placePhotoSource(token, place.photo_reference)}
                style={styles.photo}
                contentFit="cover"
                transition={150}
              />
            ) : null}

            <Text style={styles.name}>{place.name}</Text>
            <Text style={[styles.owner, { color: ownerColor }]}>Saved by {ownerLabel}</Text>
            {place.address ? <Text style={styles.address}>{place.address}</Text> : null}

            <View style={styles.metaRow}>
              {place.price_range ? <Chip label={PRICE_LABELS[place.price_range]} /> : null}
              {place.visited ? <Chip label="Visited" /> : null}
              {bothLike ? <Chip label="Both want to go" tone="accent" /> : null}
            </View>

            <GlassCard style={styles.section}>
              <Text style={styles.sectionLabel}>Your priority</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable key={value} onPress={() => onRate(place, place.rating === value ? null : value)} hitSlop={6}>
                    <Text style={[styles.star, (place.rating ?? 0) >= value && styles.starFilled]}>★</Text>
                  </Pressable>
                ))}
              </View>
            </GlassCard>

            {place.notes ? (
              <GlassCard style={styles.section}>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.notes}>{place.notes}</Text>
              </GlassCard>
            ) : null}

            <View style={styles.actionRow}>
              <ActionButton label={place.liked_by_you ? '♥ Interested' : '♡ Interested'} active={place.liked_by_you} onPress={() => onToggleLike(place)} disabled={busy} />
              <ActionButton label={place.visited ? 'Visited' : 'Mark visited'} active={place.visited} onPress={() => onToggleVisited(place)} disabled={busy} />
            </View>

            <Pressable disabled={busy} onPress={() => onEdit(place)} style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit place</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={confirmDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Remove place</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Atmosphere>
    </Modal>
  );
}

function Chip({ label, tone }: { label: string; tone?: 'accent' }) {
  return (
    <View style={[styles.chip, tone === 'accent' && styles.chipAccent]}>
      <Text style={[styles.chipText, tone === 'accent' && styles.chipTextAccent]}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, active && styles.actionActive, (pressed || disabled) && styles.actionMuted]}>
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  content: { gap: 14, paddingBottom: 48, paddingTop: 10 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: '#AEBBFF', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  close: { color: '#A9ADB7', fontSize: 15, fontWeight: '600' },
  photo: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, height: 180, width: '100%' },
  name: { color: '#F7F8FA', fontSize: 27, fontWeight: '700', letterSpacing: -0.6 },
  owner: { fontSize: 14, fontWeight: '700' },
  address: { color: '#A9ADB7', fontSize: 14 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  chipAccent: { backgroundColor: 'rgba(108,140,255,0.24)' },
  chipText: { color: '#DCE1FF', fontSize: 12, fontWeight: '600' },
  chipTextAccent: { color: '#F7F8FA' },
  section: { gap: 8 },
  sectionLabel: { color: '#A9ADB7', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  notes: { color: '#F7F8FA', fontSize: 15, lineHeight: 22 },
  stars: { flexDirection: 'row', gap: 6 },
  star: { color: 'rgba(255,255,255,0.2)', fontSize: 24 },
  starFilled: { color: '#F5B95B' },
  actionRow: { flexDirection: 'row', gap: 10 },
  action: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', minHeight: 50 },
  actionActive: { backgroundColor: 'rgba(108,140,255,0.24)', borderColor: 'rgba(108,140,255,0.5)' },
  actionMuted: { opacity: 0.6 },
  actionText: { color: '#DCE1FF', fontSize: 14, fontWeight: '700' },
  actionTextActive: { color: '#F7F8FA' },
  editButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 18, justifyContent: 'center', minHeight: 54, marginTop: 6 },
  editButtonText: { color: '#1B1E2B', fontSize: 15, fontWeight: '700' },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  deleteButtonText: { color: '#FFAAA8', fontSize: 14, fontWeight: '700' },
});
