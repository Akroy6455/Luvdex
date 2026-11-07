import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/lib/theme';

export const CONTACT_EMAIL = 'sales@solutionandnetwork.com';
export const LAST_UPDATED = '7 November 2026';

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

type Props = { title: string; intro: string; sections: LegalSection[] };

/** Plain, readable page for the Privacy Policy and Terms of Service. */
export function LegalPage({ title, intro, sections }: Props) {
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Link href="/" style={styles.back}>
            ← Back to Luvdex
          </Link>
          <Text style={styles.kicker}>LUVDEX</Text>
          <Text style={styles.title} role="heading" aria-level={1}>
            {title}
          </Text>
          <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
          <Text style={styles.p}>{intro}</Text>

          {sections.map((s, i) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.h2} role="heading" aria-level={2}>
                {i + 1}. {s.heading}
              </Text>
              {s.paragraphs?.map((p) => (
                <Text key={p} style={styles.p}>
                  {p}
                </Text>
              ))}
              {s.bullets?.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>♥</Text>
                  <Text style={[styles.p, styles.bulletText]}>{b}</Text>
                </View>
              ))}
            </View>
          ))}

          <Text style={[styles.p, styles.contact]}>Questions? Email us at {CONTACT_EMAIL}.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.deepShell },
  scroll: { padding: 16, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 760,
    backgroundColor: colors.cream,
    borderRadius: 20,
    padding: 24,
    borderTopWidth: 10,
    borderTopColor: colors.luvRed,
  },
  back: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.luvRed, marginBottom: 18 },
  kicker: { fontFamily: fonts.pixelBold, fontSize: 12, letterSpacing: 2, color: colors.luvRed },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 4 },
  updated: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft, marginTop: 6, marginBottom: 14 },
  section: { marginTop: 18 },
  h2: { fontFamily: fonts.bodyHeavy, fontSize: 19, lineHeight: 25, color: colors.ink, marginBottom: 6 },
  p: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, color: colors.ink, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  bulletDot: { color: colors.lensPink, fontSize: 12, lineHeight: 25 },
  bulletText: { flex: 1 },
  contact: { marginTop: 22, fontFamily: fonts.bodyBold },
});
