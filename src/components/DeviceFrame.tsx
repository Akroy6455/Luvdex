import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/lib/theme';

type Props = {
  /** Lights the heart lens pink, e.g. when someone is within 50 m. */
  lensOn?: boolean;
  /** Content shown inside the mint "screen". */
  children: ReactNode;
  /** Controls shown on the red shell below the screen. */
  footer?: ReactNode;
};

/** The retro Luvdex gadget: red shell, heart lens, LCD screen. */
export function DeviceFrame({ lensOn = false, children, footer }: Props) {
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.shell}>
          <View style={styles.topBar}>
            <View style={[styles.lens, lensOn && styles.lensOn]}>
              <Text style={[styles.lensHeart, lensOn && styles.lensHeartOn]}>♥</Text>
            </View>
            <View style={styles.leds}>
              <View style={[styles.led, { backgroundColor: colors.sparkYellow }]} />
              <View style={[styles.led, { backgroundColor: colors.screenMint }]} />
            </View>
            <Text style={styles.brand}>LUVDEX</Text>
          </View>

          <View style={styles.screenBezel}>
            <View style={styles.screen}>{children}</View>
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}

          <View style={styles.speaker}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.speakerLine} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.deepShell },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  shell: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.luvRed,
    borderRadius: 28,
    padding: 18,
    borderBottomWidth: 8,
    borderBottomColor: '#B92A3E',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  lens: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.cream,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensOn: {
    backgroundColor: colors.lensPink,
    shadowColor: colors.lensPink,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  lensHeart: { fontSize: 30, lineHeight: 36, color: colors.lensPink },
  lensHeartOn: { color: colors.white },
  leds: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', marginTop: 4 },
  led: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.deepShell },
  brand: {
    marginLeft: 'auto',
    fontFamily: fonts.pixelBold,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.cream,
  },
  screenBezel: {
    backgroundColor: colors.cream,
    borderRadius: 18,
    padding: 10,
    borderBottomLeftRadius: 40,
  },
  screen: {
    backgroundColor: colors.screenMint,
    borderRadius: 12,
    borderBottomLeftRadius: 32,
    borderWidth: 2,
    borderColor: colors.screenEdge,
    padding: 20,
    minHeight: 300,
  },
  footer: { marginTop: 18, gap: 12 },
  speaker: { flexDirection: 'row', justifyContent: 'flex-end', gap: 5, marginTop: 16 },
  speakerLine: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.deepShell },
});
