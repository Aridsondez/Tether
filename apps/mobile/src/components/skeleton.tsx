import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

// A single pulsing placeholder shape. Compose these into screen-specific
// layouts that mirror the real content, rather than a generic "loading" box.
export function SkeletonBlock({ width = '100%', height = 16, radius = 8, style }: SkeletonBlockProps) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.75, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.block, { width, height, borderRadius: radius }, animatedStyle, style]} />;
}

export function SkeletonCircle({ size = 56, style }: { size?: number; style?: ViewStyle }) {
  return <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />;
}

export function SkeletonRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  block: { backgroundColor: 'rgba(255,255,255,0.09)' },
  row: { flexDirection: 'row', gap: 10 },
});
