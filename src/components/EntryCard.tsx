import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  EDUCATION,
  HABITS,
  LOOKING_FOR,
  ageFrom,
  formatHeight,
  formatWeight,
  labelOf,
  lookingForColor,
  type Photo,
  type Profile,
} from '@/lib/entry';
import { colors, fonts } from '@/lib/theme';

/** A person's Entry, laid out like a page in the Luvdex: photo, type badge, stats, description. */
export function EntryCard({ profile, photos, entryNo }: { profile: Profile; photos: Photo[]; entryNo?: number }) {
  const [index, setIndex] = useState(0);
  const shown = photos.filter((p) => p.url);
  const current = shown[Math.min(index, shown.length - 1)];
  const work = [profile.job_title, profile.company].filter(Boolean).join(' at ');
  const education = [labelOf(EDUCATION, profile.education_level), profile.school].filter(Boolean).join(', ');

  const stats: [string, string][] = [
    ['HEIGHT', formatHeight(profile.height_cm, profile.units)],
    ['WEIGHT', formatWeight(profile.weight_kg, profile.units)],
  ];
  if (education) stats.push(['EDUCATION', education]);
  if (work) stats.push(['WORK', work]);
  if (profile.drinking) stats.push(['DRINKS', labelOf(HABITS, profile.drinking)]);
  if (profile.smoking) stats.push(['SMOKES', labelOf(HABITS, profile.smoking)]);

  return (
    <View>
      <View style={styles.photoFrame}>
        {current?.url ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            onPress={() => setIndex((index + 1) % Math.max(shown.length, 1))}
          >
            <Image source={{ uri: current.url }} style={styles.photo} />
          </Pressable>
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Text style={styles.silhouette}>♥</Text>
          </View>
        )}
        {shown.length > 1 ? (
          <View style={styles.dots}>
            {shown.map((p, i) => (
              <View key={p.id} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        ) : null}
      </View>

      <Text style={styles.entryNo}>No. {String(entryNo ?? 1).padStart(3, '0')}</Text>
      <Text style={styles.name}>
        {profile.first_name}, {ageFrom(profile.birthdate)}
      </Text>
      <View style={[styles.badge, { backgroundColor: lookingForColor(profile.looking_for) }]}>
        <Text style={styles.badgeText}>{labelOf(LOOKING_FOR, profile.looking_for).toUpperCase()}</Text>
      </View>

      <View style={styles.stats}>
        {stats.map(([k, v]) => (
          <View key={k} style={styles.statRow}>
            <Text style={styles.statKey}>{k}</Text>
            <Text style={styles.statVal}>{v}</Text>
          </View>
        ))}
      </View>

      {profile.bio ? <Text style={styles.bio}>“{profile.bio}”</Text> : null}

      {profile.interests.length ? (
        <View style={styles.chips}>
          {profile.interests.map((i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{i}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {profile.languages.length ? <Text style={styles.langs}>Speaks {profile.languages.join(', ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photoFrame: { borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: colors.white, backgroundColor: colors.white },
  photo: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#EEE' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenEdge },
  silhouette: { fontSize: 64, color: colors.white },
  dots: { position: 'absolute', top: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { backgroundColor: colors.white },
  entryNo: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginTop: 14 },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 28, lineHeight: 34, color: colors.ink, marginTop: 2 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  badgeText: { fontFamily: fonts.pixelBold, fontSize: 10, color: colors.white, letterSpacing: 1 },
  stats: { marginTop: 14, backgroundColor: colors.white, borderRadius: 12, padding: 12, gap: 8 },
  statRow: { flexDirection: 'row', gap: 12 },
  statKey: { width: 86, fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, paddingTop: 3 },
  statVal: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  bio: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: colors.lensPink },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  langs: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 10 },
});
