import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A } from '@/components/atmosphere';

type PlaceholderScreenProps = {
  title: string;
  description: string;
  onBack?: () => void;
};

export function PlaceholderScreen({ title, description, onBack }: PlaceholderScreenProps) {
  return (
    <Atmosphere>
      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backRow}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backLabel}>More</Text>
          </Pressable>
        ) : (
          <Text style={styles.eyebrow}>TETHER</Text>
        )}
        <View style={styles.centerWrap}>
          <GlassCard style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            <Text style={styles.kicker}>COMING SOON</Text>
          </GlassCard>
        </View>
      </SafeAreaView>
    </Atmosphere>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  eyebrow: { color: '#AEBBFF', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  backChevron: { color: PARTNER_A, fontSize: 24, fontWeight: '700', marginTop: -2 },
  backLabel: { color: PARTNER_A, fontSize: 16, fontWeight: '600' },
  centerWrap: { flex: 1, justifyContent: 'center' },
  card: { gap: 10 },
  title: { color: '#F7F8FA', fontSize: 27, fontWeight: '700', letterSpacing: -0.7 },
  description: { color: '#B8BBC5', fontSize: 15, lineHeight: 22 },
  kicker: { color: '#ABB9FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 4 },
});
