import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { PLACE_CATEGORIES, tetherApi, type Place } from '@/lib/api';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function categoryLabel(category: Place['category']) {
  return PLACE_CATEGORIES.find((entry) => entry.value === category)?.label ?? 'Place';
}

type PlacePreviewProps = {
  place: Place;
  token: string;
  bottomOffset?: number;
  myColor?: string;
  partnerColor?: string;
  onPress: () => void;
  onToggleLike: () => void;
};

export function PlacePreview({ place, token, bottomOffset = 22, myColor = PARTNER_A, partnerColor = PARTNER_B, onPress, onToggleLike }: PlacePreviewProps) {
  const ownerColor = place.created_by_you ? myColor : partnerColor;
  const ownerLabel = place.created_by_you ? 'You' : (place.created_by_name ?? 'Your partner');
  const bothLike = place.liked_by_you && place.liked_by_partner;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.wrap, { bottom: bottomOffset }]}>
      <GlassCard style={styles.card}>
        <Pressable onPress={onPress} style={styles.row}>
          {place.photo_reference ? (
            <Image
              source={tetherApi.placePhotoSource(token, place.photo_reference)}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={[styles.photoFallback, { backgroundColor: `${ownerColor}2E` }]}>
              <Text style={[styles.photoFallbackText, { color: ownerColor }]}>{place.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            <Text style={[styles.saved, { color: ownerColor }]}>Saved by {ownerLabel} · {categoryLabel(place.category)}</Text>
            <View style={styles.metaRow}>
              {bothLike ? (
                <Text style={styles.bothPill}>Both want to go</Text>
              ) : place.liked_by_you ? (
                <Text style={styles.pill}>You want to go</Text>
              ) : place.liked_by_partner ? (
                <Text style={styles.pill}>{ownerLabel === 'You' ? 'Your partner wants to go' : `${ownerLabel} wants to go`}</Text>
              ) : null}
              {place.price_range ? <Text style={styles.price}>{PRICE_LABELS[place.price_range]}</Text> : null}
            </View>
          </View>
        </Pressable>
        <Pressable onPress={onToggleLike} hitSlop={10} style={styles.likeButton}>
          <Text style={[styles.likeText, place.liked_by_you && styles.likeTextActive]}>
            {place.liked_by_you ? '♥ Interested' : '♡ Interested'}
          </Text>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { left: 16, position: 'absolute', right: 16 },
  card: { gap: 12, padding: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  photo: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, height: 56, width: 56 },
  photoFallback: { alignItems: 'center', borderRadius: 16, height: 56, justifyContent: 'center', width: 56 },
  photoFallbackText: { fontSize: 20, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  name: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' },
  saved: { fontSize: 12, fontWeight: '600' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  pill: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, color: '#DCE1FF', fontSize: 11, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  bothPill: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 100, color: '#F7F8FA', fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  price: { color: '#A9ADB7', fontSize: 12, fontWeight: '600' },
  likeButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 14, borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', paddingTop: 12 },
  likeText: { color: '#A9ADB7', fontSize: 14, fontWeight: '700' },
  likeTextActive: { color: '#FF7EA8' },
});
