import { StyleSheet, View } from 'react-native';

import { PARTNER_A, PARTNER_B } from '@/components/atmosphere';

type MapPinProps = {
  ownedByYou: boolean;
  bothLike: boolean;
  myColor?: string;
  partnerColor?: string;
};

export function MapPin({ ownedByYou, bothLike, myColor = PARTNER_A, partnerColor = PARTNER_B }: MapPinProps) {
  const fill = ownedByYou ? myColor : partnerColor;
  const ring = ownedByYou ? partnerColor : myColor;

  return (
    <View style={styles.wrap}>
      {bothLike ? <View style={[styles.ring, { borderColor: ring }]} /> : null}
      <View style={[styles.dot, { backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  ring: { borderRadius: 17, borderWidth: 2.5, height: 34, position: 'absolute', width: 34 },
  dot: { borderColor: '#fff', borderRadius: 10, borderWidth: 2, height: 20, width: 20 },
});
