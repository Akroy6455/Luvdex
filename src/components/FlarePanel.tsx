// Flares: light one to show your approximate location and Entry to nearby people,
// and see the Flares that reached you.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { fireFlare, getLuvballStatus, type LuvballStatus } from '@/lib/luvballs';
import { distanceAway, minutesLeft, type FlareSpot } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

const FLARE_ORANGE = '#FF7A1A';

/** "Fire a Flare" control for the Radar (only shown while the Radar has your location). */
export function FlareControl() {
  const [status, setStatus] = useState<LuvballStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    getLuvballStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!status) return null;
  const km = Math.round(status.flare_radius_m / 100) / 10;
  const hours = status.flare_minutes >= 60 ? `${status.flare_minutes / 60} hour${status.flare_minutes === 60 ? '' : 's'}` : `${status.flare_minutes} minutes`;

  const fire = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fireFlare();
      setMessage(
        res.result === 'fired'
          ? `🔥 Your Flare reached ${res.reached} ${res.reached === 1 ? 'person' : 'people'} nearby.`
          : `Nobody is within ${km} km right now, so your Flare wasn't used. Try again later.`,
      );
      setConfirming(false);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not fire your Flare.');
    } finally {
      setBusy(false);
    }
  };

  if (status.my_flare) {
    return (
      <View style={[styles.box, styles.lit]}>
        <Text style={styles.title}>🔥 Your Flare is lit</Text>
        <Text style={styles.body}>
          {`Reached ${status.my_flare.reached} ${status.my_flare.reached === 1 ? 'person' : 'people'} · ${minutesLeft(status.my_flare.expires_at)}`}
        </Text>
        {message ? <Text style={styles.body}>{message}</Text> : null}
      </View>
    );
  }

  if (status.flares <= 0) {
    const next = status.next_flare_at
      ? new Date(status.next_flare_at).toLocaleDateString([], { day: 'numeric', month: 'short' })
      : null;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>🔥 No Flares left</Text>
        <Text style={styles.body}>{next ? `Your next free Flare arrives on ${next}.` : 'You get 1 free Flare every month.'}</Text>
        {message ? <Text style={styles.body}>{message}</Text> : null}
      </View>
    );
  }

  if (!confirming) {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMessage(null);
            setConfirming(true);
          }}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.pillText}>🔥 Fire a Flare</Text>
          <Text style={styles.pillHint}>{`${status.flares} of ${status.flares_max} · reach people up to ${km} km away`}</Text>
        </Pressable>
        {message ? <Text style={[styles.body, styles.after]}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.confirm]}>
      <Text style={styles.title}>Fire a Flare?</Text>
      <Text style={styles.body}>
        {`For ${hours}, up to ${status.flare_max_recipients} people within ${km} km will see your approximate location ` +
          `(rounded to about 50 m) and your Entry, and get a notification with your first name. ` +
          `Uses 1 of your ${status.flares} Flare${status.flares === 1 ? '' : 's'}. If nobody is nearby, it isn't used.`}
      </Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={fire}
          disabled={busy}
          style={({ pressed }) => [styles.fire, (pressed || busy) && { opacity: 0.7 }]}
        >
          <Text style={styles.fireText}>{busy ? 'Firing…' : '🔥 Fire it'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} disabled={busy} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

/** Flares from people nearby that reached you. */
export function FlaresNearby({ flares, onOpen }: { flares: FlareSpot[]; onOpen: (userId: string) => void }) {
  if (!flares.length) return null;
  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>🔥 Flares near you</Text>
      {flares.map((f) => (
        <Pressable
          key={f.flare_id}
          accessibilityRole="button"
          onPress={() => onOpen(f.user_id)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        >
          {f.photo_url ? (
            <Image source={{ uri: f.photo_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>
              {f.first_name}, {f.age}
            </Text>
            <Text style={styles.cardMeta}>
              {`${distanceAway(f.distance_m)} · ${minutesLeft(f.expires_at)}`}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFF1E6',
    borderWidth: 2,
    borderColor: FLARE_ORANGE,
  },
  pillText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  pillHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  box: { marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: colors.white, gap: 6 },
  lit: { backgroundColor: '#FFF1E6', borderWidth: 2, borderColor: FLARE_ORANGE },
  confirm: { borderWidth: 2, borderColor: FLARE_ORANGE },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  after: { marginTop: -4, marginBottom: 10 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.luvRed },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  fire: { backgroundColor: FLARE_ORANGE, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  fireText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.white },
  cancel: { paddingHorizontal: 8, paddingVertical: 9 },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft, textDecorationLine: 'underline' },
  list: { marginTop: 14, gap: 10 },
  listTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFF1E6',
    borderWidth: 2,
    borderColor: FLARE_ORANGE,
  },
  thumb: { width: 52, height: 52, borderRadius: 26 },
  thumbEmpty: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink },
  cardMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.inkSoft },
});
