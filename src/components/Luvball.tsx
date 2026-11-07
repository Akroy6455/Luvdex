import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

/** Original Luvball: pink-over-cream ball with a heart badge (no band, no button). */
export function Luvball({ size = 96 }: { size?: number }) {
  const badge = size * 0.36;
  return (
    <View style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.top, { height: size / 2 }]} />
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, marginTop: -badge / 2, marginLeft: -badge / 2 }]}>
        <Text style={{ color: colors.white, fontSize: badge * 0.6, lineHeight: badge * 0.75 }}>♥</Text>
      </View>
      <View style={[styles.shine, { width: size * 0.18, height: size * 0.1, top: size * 0.14, left: size * 0.2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    overflow: 'hidden',
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.deepShell,
  },
  top: { backgroundColor: colors.lensPink },
  badge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: colors.luvRed,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shine: { position: 'absolute', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', transform: [{ rotate: '-25deg' }] },
});
