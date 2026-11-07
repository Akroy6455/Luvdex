import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Luvball } from '@/components/Luvball';
import { throwLuvball, type ThrowResult } from '@/lib/luvballs';
import { BAND_LABEL, type OtherEntry } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

type Props = {
  entry: OtherEntry;
  onResult: (r: ThrowResult) => void;
};

/** The Luvball and its throw button, with a short throw-and-wobble animation. */
export function ThrowPanel({ entry, onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const inReach = entry.in_range || entry.grace;
  const canThrow = inReach && entry.gps_ok && !entry.thrown_by_me && sent === null;

  const animate = () =>
    new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(y, { toValue: -140, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(scale, { toValue: 0.55, duration: 380, useNativeDriver: false }),
        ]),
        Animated.sequence(
          [1, -1, 1, -1, 0].map((v) =>
            Animated.timing(spin, { toValue: v, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          ),
        ),
      ]).start(() => resolve());
    });

  const reset = () => {
    y.setValue(0);
    scale.setValue(1);
    spin.setValue(0);
  };

  const onThrow = async () => {
    if (!canThrow || busy) return;
    setBusy(true);
    setError(null);
    try {
      const [result] = await Promise.all([throwLuvball(entry.id), animate()]);
      if (result.result === 'thrown') setSent(result.remaining);
      onResult(result);
    } catch (e) {
      reset();
      setError(e instanceof Error ? e.message : 'Could not throw. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  let label: string;
  let hint: string | null = null;
  if (sent !== null || entry.thrown_by_me) {
    label = '✓ Luvball thrown';
    hint =
      sent !== null
        ? `Sent! They'll get an anonymous alert in a few minutes. ${sent} Luvball${sent === 1 ? '' : 's'} left in your stash.`
        : "Waiting to see if they throw one back. If they do, it's a match.";
  } else if (!inReach) {
    label = `Get closer: ${entry.distance_band ? BAND_LABEL[entry.distance_band] : 'not nearby right now'}`;
    hint = 'Walk closer and the button lights up.';
  } else if (!entry.gps_ok) {
    label = 'GPS too weak to aim';
    hint = 'Move somewhere with a clearer view of the sky, then come back to this Entry.';
  } else {
    label = busy ? 'Throwing…' : 'Throw Luvball ♥';
    hint = entry.grace ? "They just left range, but you still have a few minutes." : 'They won\'t know it was you unless they throw one back.';
  }

  const rotate = spin.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateY: y }, { scale }, { rotate }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Throw Luvball" onPress={onThrow} disabled={!canThrow || busy}>
          <View style={[styles.ballRing, canThrow && styles.ballRingReady]}>
            <Luvball size={86} />
          </View>
        </Pressable>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        onPress={onThrow}
        disabled={!canThrow || busy}
        style={[styles.button, canThrow ? styles.buttonReady : styles.buttonOff]}
      >
        <Text style={[styles.buttonText, !canThrow && styles.buttonTextOff]}>{label}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {error && error.includes('out of Luvballs') ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/luvballs')}>
          <Text style={styles.more}>Get more Luvballs →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  ballRing: { padding: 6, borderRadius: 60, borderWidth: 3, borderColor: 'transparent' },
  ballRingReady: { borderColor: colors.lensPink, backgroundColor: 'rgba(255,122,168,0.18)' },
  button: { alignSelf: 'stretch', minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 4 },
  buttonReady: { backgroundColor: colors.white, borderBottomColor: '#E6C9D2' },
  buttonOff: { backgroundColor: 'rgba(255,255,255,0.35)', borderBottomColor: 'transparent' },
  buttonText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: colors.luvRed, textAlign: 'center' },
  buttonTextOff: { color: colors.white },
  hint: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.cream, textAlign: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, color: colors.white, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8 },
  more: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.sparkYellow, textDecorationLine: 'underline' },
});
