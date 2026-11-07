import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { EntryCard } from '@/components/EntryCard';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { BAND_LABEL, getEntry, type OtherEntry } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

/** Someone else's Entry. Only opens while they're (recently) on your Radar. */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, loading } = useAuth();
  const { profile } = useProfile();
  const [entry, setEntry] = useState<OtherEntry | null | undefined>(undefined);

  useEffect(() => {
    if (!session || !id) return;
    getEntry(String(id))
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [session, id]);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/radar'));

  return (
    <DeviceFrame
      lensOn={!!entry?.in_range}
      footer={
        <>
          {entry ? (
            <ShellButton
              label={entry.in_range ? '♥ Luvballs arrive in the next update' : `Get closer: ${entry.distance_band ? BAND_LABEL[entry.distance_band] : 'not nearby now'}`}
              onPress={() => {}}
              disabled
            />
          ) : null}
          <ShellButton variant="ghost" label="← Back to Radar" onPress={back} />
        </>
      }
    >
      <Text style={styles.kicker}>LUVDEX ENTRY</Text>
      {entry === undefined ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 40 }} />
      ) : entry === null ? (
        <View style={styles.gone}>
          <Text style={styles.goneTitle}>This Entry isn't available</Text>
          <Text style={styles.body}>They may have left your Radar, switched on Ghost mode, or changed who can see them.</Text>
        </View>
      ) : (
        <>
          {entry.distance_band ? (
            <Text style={[styles.band, entry.in_range && styles.bandInRange]}>
              {entry.in_range ? '♥ Within Luvball range (50 m)' : BAND_LABEL[entry.distance_band]}
            </Text>
          ) : null}
          <EntryCard profile={entry} photos={entry.photos} units={profile?.units ?? 'metric'} />
        </>
      )}
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 8 },
  band: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft, marginBottom: 10 },
  bandInRange: { color: colors.luvRed },
  gone: { marginVertical: 30, gap: 6 },
  goneTitle: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
});
