import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { useAuth } from '@/lib/auth';
import { getConversations, type Conversation } from '@/lib/chat';
import { useAppActive } from '@/lib/useAppActive';
import { LOOKING_FOR, labelOf, lookingForColor } from '@/lib/entry';
import { timeAgo } from '@/lib/luvballs';
import { colors, fonts } from '@/lib/theme';

/** Your matches, as conversations. */
export default function Caught() {
  const { session, loading } = useAuth();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const active = useAppActive();

  useFocusEffect(
    useCallback(() => {
      if (!session || !active) return;
      const load = () =>
        getConversations()
          .then(setItems)
          .catch(() => setItems((prev) => prev ?? []));
      load();
      const t = setInterval(load, 30_000);
      return () => clearInterval(t);
    }, [session, active]),
  );

  if (!loading && !session) return <Redirect href="/welcome" />;

  return (
    <DeviceFrame footer={<ShellButton variant="ghost" label="← Back to Radar" onPress={() => router.replace('/radar')} />}>
      <Text style={styles.kicker}>CAUGHT · {items?.length ?? 0}</Text>
      {items === null ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 30 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.body}>
            When you and someone nearby both throw a Luvball at each other, you catch each other and can chat here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((c, i) => (
            <Pressable
              key={c.match_id}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${c.first_name}`}
              onPress={() => router.push({ pathname: '/chat/[matchId]', params: { matchId: c.match_id } })}
              style={[styles.row, c.unread > 0 && styles.rowUnread]}
            >
              {c.photo_url ? (
                <Image source={{ uri: c.photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Text style={{ fontSize: 22, color: colors.white }}>♥</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.first_name}, {c.age}
                  </Text>
                  <Text style={styles.when}>{timeAgo(c.last_at ?? c.matched_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: lookingForColor(c.looking_for) }]}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    No. {String(i + 1).padStart(3, '0')} · {labelOf(LOOKING_FOR, c.looking_for).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {c.last_body ? `${c.last_from_me ? 'You: ' : ''}${c.last_body}` : 'You caught each other. Say hi 👋'}
                </Text>
              </View>
              {c.unread > 0 ? (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{c.unread > 9 ? '9+' : c.unread}</Text>
                </View>
              ) : null}
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
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 10, borderWidth: 2, borderColor: colors.screenEdge },
  rowUnread: { borderColor: colors.lensPink, backgroundColor: '#FFF0F5' },
  photo: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE', borderWidth: 2, borderColor: colors.lensPink },
  photoEmpty: { backgroundColor: colors.screenEdge, alignItems: 'center', justifyContent: 'center' },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink, flexShrink: 1 },
  when: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2, maxWidth: '100%' },
  badgeText: { fontFamily: fonts.pixelBold, fontSize: 8, color: colors.white, letterSpacing: 0.5 },
  preview: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  previewUnread: { fontFamily: fonts.bodyBold, color: colors.ink },
  unread: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.luvRed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.white },
});
