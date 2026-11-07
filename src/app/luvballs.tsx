import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { Luvball } from '@/components/Luvball';
import { useAuth } from '@/lib/auth';
import { getLuvballStatus, getNotifications, markRead, timeAgo, type AppNotification } from '@/lib/luvballs';
import { colors, fonts } from '@/lib/theme';

/** Anonymous "someone threw a Luvball at you" alerts, plus today's remaining throws. */
export default function Luvballs() {
  const { session, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      (async () => {
        try {
          const [all, status] = await Promise.all([getNotifications(), getLuvballStatus()]);
          const received = all.filter((n) => n.type === 'luvball_received');
          setItems(received);
          setRemaining(status.remaining);
          await markRead(received.filter((n) => !n.read_at).map((n) => n.id));
        } catch {
          setItems([]);
        }
      })();
    }, [session]),
  );

  if (!loading && !session) return <Redirect href="/welcome" />;

  return (
    <DeviceFrame footer={<ShellButton variant="ghost" label="← Back to Radar" onPress={() => router.replace('/radar')} />}>
      <Text style={styles.kicker}>LUVBALLS</Text>

      <View style={styles.stock}>
        <Luvball size={54} />
        <View style={{ flex: 1 }}>
          <Text style={styles.stockTitle}>{remaining === null ? '…' : remaining} left to throw today</Text>
          <Text style={styles.body}>You get 10 every 24 hours. Each one you throw stays active for 7 days.</Text>
        </View>
      </View>

      <Text style={styles.section}>Thrown at you</Text>
      {items === null ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 20 }} />
      ) : items.length === 0 ? (
        <Text style={styles.body}>No Luvballs yet. Get out there: the more you're on the Radar, the more people can find you.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((n) => (
            <View key={n.id} style={[styles.item, !n.read_at && styles.itemNew]}>
              <Text style={styles.itemIcon}>💘</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Someone nearby threw a Luvball at you</Text>
                <Text style={styles.itemTime}>{timeAgo(n.deliver_at)}</Text>
              </View>
              {!n.read_at ? <Text style={styles.newTag}>NEW</Text> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.how}>
        <Text style={styles.howTitle}>Who threw it?</Text>
        <Text style={styles.body}>
          Luvballs are anonymous. Throw one at the people you like when you're near them. If one of them threw at you, you'll
          catch each other and it's a match. 💞
        </Text>
      </View>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 10 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 12, borderWidth: 2, borderColor: colors.screenEdge },
  stockTitle: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  section: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink, marginTop: 20, marginBottom: 8 },
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: colors.screenEdge },
  itemNew: { borderColor: colors.lensPink, backgroundColor: '#FFF0F5' },
  itemIcon: { fontSize: 24 },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  itemTime: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  newTag: { fontFamily: fonts.pixelBold, fontSize: 10, color: colors.luvRed },
  how: { marginTop: 20, padding: 12, borderRadius: 12, backgroundColor: colors.cream, gap: 4 },
  howTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
});
