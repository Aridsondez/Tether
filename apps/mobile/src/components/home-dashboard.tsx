import { GlassView } from 'expo-glass-effect';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PARTNER_A, PARTNER_B, hexToRgba, shadeHex } from '@/components/atmosphere';
import type { PartnerNote } from '@/lib/api';

function daysSince(iso: string) {
  const start = new Date(iso).getTime();
  const days = Math.floor((Date.now() - start) / 86_400_000);
  return Math.max(days, 0);
}

type HomeDashboardProps = {
  userName: string;
  partnerName: string | null;
  connectedAt: string;
  diningBudget?: { spent: number; limit: number; remaining: number } | null;
  partnerNotes?: PartnerNote[];
  onOpenPartnerNotes?: () => void;
  myColor?: string;
  partnerColor?: string;
};

export function HomeDashboard({
  userName,
  partnerName,
  connectedAt,
  diningBudget,
  partnerNotes = [],
  onOpenPartnerNotes,
  myColor = PARTNER_A,
  partnerColor = PARTNER_B,
}: HomeDashboardProps) {
  const partnerLabel = partnerName ?? 'Your partner';
  const days = daysSince(connectedAt);

  return (
    <View style={styles.container}>
      <Pressable onPress={onOpenPartnerNotes} style={styles.partnerRow}>
        <View style={styles.avatars}>
          <View style={[styles.avatar, { backgroundColor: myColor }]}>
            <Text style={styles.avatarTextDark}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={[styles.avatar, styles.avatarOverlap, { backgroundColor: partnerColor }]}>
            <Text style={styles.avatarTextLight}>{partnerLabel.charAt(0).toUpperCase()}</Text>
          </View>
          {partnerNotes.length > 0 ? <View style={styles.notesDot} /> : null}
        </View>
        <Text style={styles.partnerNames}>{userName} & {partnerLabel}</Text>
        <Text style={styles.partnerRowChevron}>›</Text>
      </Pressable>

      <View>
        <Text style={styles.togetherLabel}>Together for</Text>
        <Text style={styles.togetherValue}>{days.toLocaleString()} days</Text>
      </View>

      <GlassCard>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Trip to Japan</Text>
          <Text style={[styles.cardBadge, { color: PARTNER_A }]}>62%</Text>
        </View>
        <Text style={styles.cardSubtitle}>Shared savings goal · 8 months to go</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '62%', backgroundColor: PARTNER_A }]} />
        </View>
      </GlassCard>

      <GlassCard style={styles.dateCard}>
        <View style={styles.dateInfo}>
          <Text style={styles.cardTitleSm}>Dinner at Cosme</Text>
          <Text style={styles.cardSubtitle}>Sat · 7:30 PM · both free</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: hexToRgba(PARTNER_A, 0.2) }]}>
          <Text style={[styles.pillText, { color: shadeHex(PARTNER_A, -30) }]}>in 2 days</Text>
        </View>
      </GlassCard>

      <Text style={styles.sectionLabel}>This month</Text>
      <View style={styles.statsGrid}>
        <StatTile
          label="Date spend"
          value={diningBudget ? `$${Math.round(diningBudget.spent)}` : '—'}
          caption={diningBudget ? `of $${Math.round(diningBudget.limit)}` : 'set a budget'}
        />
        <StatTile label="Shared goals" value="2" caption="active" />
        <StatTile label="Dates" value="3" caption="planned" />
      </View>

      <Text style={styles.sectionLabel}>Recent memory</Text>
      <View style={styles.photo}>
        <Text style={styles.photoLabel}>PHOTO — beach day</Text>
        <Text style={styles.photoCaption}>Beach day · Jul 12</Text>
      </View>

      <View
        style={[
          styles.aiCard,
          { backgroundColor: hexToRgba(PARTNER_A, 0.12), borderColor: hexToRgba(PARTNER_A, 0.28) },
        ]}>
        <Text style={[styles.aiKicker, { color: PARTNER_A }]}>AI SUGGESTION</Text>
        <Text style={styles.aiBody}>
          {diningBudget
            ? `You have $${Math.max(0, Math.round(diningBudget.remaining))} left in your date budget. Want a plan for Saturday under $120?`
            : 'Set a dining budget to get date ideas that match your month.'}
        </Text>
      </View>

      <Pressable style={styles.aiPill}>
        <View style={[styles.aiDot, { backgroundColor: PARTNER_B }]} />
        <Text style={styles.aiPillText}>Ask about your relationship, plans, or budget…</Text>
        <View style={styles.micButton}>
          <View style={styles.micIcon} />
        </View>
      </Pressable>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <GlassView colorScheme="dark" glassEffectStyle="regular" style={[styles.glassCard, style]} tintColor="rgba(24,27,34,0.5)">
      {children}
    </GlassView>
  );
}

function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <GlassView colorScheme="dark" glassEffectStyle="regular" style={styles.statTile} tintColor="rgba(24,27,34,0.5)">
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  partnerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatars: { flexDirection: 'row' },
  avatar: { alignItems: 'center', borderColor: '#090A0D', borderRadius: 22, borderWidth: 2, height: 44, justifyContent: 'center', width: 44 },
  avatarOverlap: { marginLeft: -14 },
  avatarTextDark: { color: '#111318', fontSize: 16, fontWeight: '700' },
  avatarTextLight: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notesDot: { backgroundColor: PARTNER_B, borderColor: '#090A0D', borderRadius: 6, borderWidth: 2, height: 12, position: 'absolute', right: -2, top: -2, width: 12 },
  partnerNames: { color: '#A9ADB7', flex: 1, fontSize: 13, fontWeight: '500' },
  partnerRowChevron: { color: '#8E93A1', fontSize: 18, fontWeight: '700' },
  togetherLabel: { color: '#A9ADB7', fontSize: 15, fontWeight: '500' },
  togetherValue: { color: '#F7F8FA', fontSize: 40, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  glassCard: { borderColor: 'rgba(255,255,255,0.14)', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 20 },
  rowBetween: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '600' },
  cardTitleSm: { color: '#F7F8FA', fontSize: 16, fontWeight: '600' },
  cardBadge: { fontSize: 13, fontWeight: '700' },
  cardSubtitle: { color: '#A9ADB7', fontSize: 13, marginTop: 2 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, height: 8, marginTop: 14, overflow: 'hidden' },
  progressFill: { borderRadius: 5, height: '100%' },
  dateCard: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18 },
  dateInfo: { flexShrink: 1, gap: 3 },
  pill: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statTile: { borderColor: 'rgba(255,255,255,0.14)', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, flex: 1, overflow: 'hidden', padding: 14 },
  statLabel: { color: '#A9ADB7', fontSize: 11, fontWeight: '500' },
  statValue: { color: '#F7F8FA', fontSize: 18, fontWeight: '700', marginTop: 4 },
  statCaption: { color: '#A9ADB7', fontSize: 11 },
  photo: { alignItems: 'flex-start', backgroundColor: '#1A1C23', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, height: 150, justifyContent: 'flex-end', overflow: 'hidden', padding: 14 },
  photoLabel: { color: 'rgba(255,255,255,0.45)', fontFamily: 'ui-monospace', fontSize: 12, position: 'absolute', alignSelf: 'center', top: '45%' },
  photoCaption: { color: '#fff', fontSize: 13, fontWeight: '600' },
  aiCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  aiKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  aiBody: { color: '#F7F8FA', fontSize: 14, lineHeight: 21 },
  aiPill: { alignItems: 'center', backgroundColor: 'rgba(24,27,34,0.6)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, height: 50, paddingHorizontal: 16, paddingRight: 8 },
  aiDot: { borderRadius: 4, height: 8, width: 8 },
  aiPillText: { color: '#A9ADB7', flex: 1, fontSize: 13 },
  micButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  micIcon: { borderColor: '#F7F8FA', borderRadius: 5, borderWidth: 1.5, height: 14, width: 10 },
});
