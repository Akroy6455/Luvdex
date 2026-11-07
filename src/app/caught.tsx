import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { useAuth } from '@/lib/auth';
import { LOOKING_FOR, labelOf, lookingForColor } from '@/lib/entry';
import { getMatches, timeAgo, type Match } from '@/lib/luvballs';
import { colors, fonts } from '@/lib/theme';

/** Your matches: people you caught each other with. */
export default function Caught() {
  const { session, loading } = useAuth();
  const [matches, setMatches] = useState<Match[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      getMatches()
        .then(setMatches)
        .catch(() => setMatches([]));
    }, [session]),
  );

  if (!loading && !session) return <Redirect href="/welcome" />;

  return (
    <DeviceFrame footer={<ShellButton variant="ghost" label="← Back to Radar" onPress={() => router.replace('/radar')} />}>
      <Text style={styles.kicker}>CAUGHT · {matches?.length ?? 0}</Text>
      {matches === null ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 30 }} />
      ) : matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.body}>
            When you and someone nearby both throw a Luvball at each other, you catch each other and they appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {matches.map((m, i) => (
            <Pressable
              key={m.match_id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: m.user_id } })}
              style={styles.tile}
            >
              {m.photo_url ? (
                <Image source={{ uri: m.photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Text style={{ fontSize: 36, color: colors.white }}>♥</Text>
                </View>
              )}
              <Text style={styles.no}>No. {String(i + 1).padStart(3, '0')}</Text>
              <Text style={styles.name}>
                {m.first_name}, {m.age}
              </Text>
              <View style={[styles.badge, { backgroundColor: lookingForColor(m.looking_for) }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {labelOf(LOOKING_FOR, m.looking_for).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.when}>Caught {timeAgo(m.matched_at)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 10 },
  empty: { marginVertical: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.white, borderRadius: 14, padding: 8, borderWidth: 2, borderColor: colors.lensPink },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#EEE' },
  photoEmpty: { backgroundColor: colors.screenEdge, alignItems: 'center', justifyContent: 'center' },
  no: { fontFamily: fonts.pixel, fontSize: 9, color: colors.inkSoft, marginTop: 6 },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3, maxWidth: '100%' },
  badgeText: { fontFamily: fonts.pixelBold, fontSize: 8, color: colors.white, letterSpacing: 0.5 },
  when: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 4 },
});
