import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';

export const PARTNER_A = '#6C8CFF';
export const PARTNER_B = '#FF7EA8';

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function shadeHex(hex: string, amount: number) {
  const clean = hex.replace('#', '');
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(clean.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(clean.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(clean.slice(4, 6), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

export function mixHex(a: string, b: string) {
  const ca = a.replace('#', '');
  const cb = b.replace('#', '');
  const r = Math.round((parseInt(ca.slice(0, 2), 16) + parseInt(cb.slice(0, 2), 16)) / 2);
  const g = Math.round((parseInt(ca.slice(2, 4), 16) + parseInt(cb.slice(2, 4), 16)) / 2);
  const bl = Math.round((parseInt(ca.slice(4, 6), 16) + parseInt(cb.slice(4, 6), 16)) / 2);
  return `rgb(${r},${g},${bl})`;
}

export function Atmosphere({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.glowThree} />
      {children}
    </View>
  );
}

export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <GlassView colorScheme="dark" glassEffectStyle="regular" style={[styles.glassCard, style]} tintColor="rgba(28, 32, 46, 0.66)">
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#090A0D', flex: 1, overflow: 'hidden' },
  glowOne: { backgroundColor: PARTNER_A, borderRadius: 999, height: 340, opacity: 0.22, position: 'absolute', left: -140, top: -160, width: 340 },
  glowTwo: { backgroundColor: PARTNER_B, borderRadius: 999, height: 360, opacity: 0.2, position: 'absolute', right: -180, top: 40, width: 360 },
  glowThree: { backgroundColor: PARTNER_A, borderRadius: 999, bottom: -160, height: 320, left: -160, opacity: 0.14, position: 'absolute', width: 320 },
  glassCard: { borderColor: 'rgba(255,255,255,0.12)', borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 24 },
});
