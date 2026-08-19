import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Atmosphere, GlassCard } from '@/components/atmosphere';
import { EditProfileSheet } from '@/components/edit-profile-sheet';
import { ApiError, RELATIONSHIP_STAGES, type MeResponse, type Relationship, tetherApi } from '@/lib/api';

function formatBirthday(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function relationshipStatus(relationship: Relationship | null | undefined, stage?: string | null) {
  if (!relationship) return null;
  if (relationship.relationship_status !== 'active') return relationship.role === 'owner' ? 'Invitation pending' : 'Invitation waiting';
  const label = RELATIONSHIP_STAGES.find((item) => item.value === stage)?.label ?? 'Partners';
  return `${label} with ${relationship.partner_display_name ?? 'your person'}`;
}

export default function ProfileScreen() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // getToken's identity from useAuth() isn't stable across renders; depending
  // on it directly would re-fire this effect on every render, spamming /api/me
  // and — since each response is a new object — stomping on in-progress edits
  // in EditProfileSheet every time it resets from the fresh `me` prop.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const reload = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      setMe(await tetherApi.me(token));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not load your connection status.');
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setMe(null);
      return;
    }
    void reload();
  }, [isSignedIn, reload]);

  const relationship = me?.relationship;
  const partnerName = relationship?.partner_display_name ?? null;
  const displayName = me?.user.display_name || user?.firstName || 'Your profile';
  const birthdaySummary = formatBirthday(me?.profile?.birthday);
  const myColor = me?.user.color ?? null;

  const statusLabel = relationshipStatus(relationship, me?.relationship_profile?.relationship_stage);

  function confirmSever() {
    Alert.alert(
      'Sever this connection?',
      `This will end your shared Tether with ${partnerName ?? 'this person'}. This can’t be undone.`,
      [
        { text: 'Keep connection', style: 'cancel' },
        {
          text: 'Sever connection', style: 'destructive',
          onPress: () => void (async () => {
            try {
              const token = await getTokenRef.current();
              if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
              await tetherApi.cancelPendingRelationship(token);
              await reload();
            } catch (reason) {
              Alert.alert('Could not sever connection', reason instanceof ApiError ? reason.message : 'Please try again.');
            }
          })(),
        },
      ],
    );
  }

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setEditingProfile(true)}>
            <GlassCard style={styles.section}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGrow}>
                  <View style={styles.nameRow}>
                    {myColor ? <View style={[styles.colorDot, { backgroundColor: myColor }]} /> : null}
                    <Text style={styles.sectionTitle}>{displayName}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Account</Text>
                  <Text style={styles.sectionCopy}>{birthdaySummary ? `Birthday · ${birthdaySummary}` : displayName}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>

          <Pressable onPress={() => router.push('/more/partner')}>
            <GlassCard style={styles.section}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGrow}>
                  <Text style={styles.sectionTitle}>About {partnerName ?? 'your partner'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>

          <Pressable onPress={() => router.push('/more/about-us')}>
            <GlassCard style={styles.section}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGrow}>
                  <Text style={styles.sectionTitle}>About us</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>

          <Pressable onPress={() => router.push('/more/personalization')}>
            <GlassCard style={styles.section}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGrow}>
                  <Text style={styles.sectionTitle}>Personalization</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>

          <Pressable onPress={() => router.push('/more/finances')}>
            <GlassCard style={styles.section}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGrow}>
                  <Text style={styles.sectionTitle}>Finances</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </GlassCard>
          </Pressable>

          {statusLabel ? <GlassCard style={styles.statusCard}>
            <View style={styles.statusLine}><View style={styles.statusDot} /><Text style={styles.statusText}>{statusLabel}</Text></View>
            <Pressable onPress={confirmSever} hitSlop={8}><Text style={styles.severText}>Sever connection</Text></Pressable>
          </GlassCard> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>

      <EditProfileSheet
        visible={editingProfile}
        onClose={() => setEditingProfile(false)}
        getToken={() => getTokenRef.current()}
        me={me}
        onSaved={setMe}
      />
    </Atmosphere>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  scrollContent: { gap: 12, paddingBottom: 32, paddingTop: 12 },
  section: { gap: 6 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  colorDot: { borderRadius: 6, height: 12, width: 12 },
  sectionTitle: { color: '#F7F8FA', fontSize: 18, fontWeight: '700' },
  sectionCopy: { color: '#B8BBC5', fontSize: 14, lineHeight: 20 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowGrow: { flexShrink: 1, gap: 6 },
  chevron: { color: '#8E93A1', fontSize: 22, fontWeight: '600' },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20 },
  statusCard: { gap: 12, marginTop: 4 },
  statusLine: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  statusDot: { backgroundColor: '#7BC67E', borderRadius: 5, height: 10, width: 10 },
  statusText: { color: '#DDE3F7', fontSize: 14, fontWeight: '700' },
  severText: { color: '#FFAAA8', fontSize: 13, fontWeight: '700' },
});
