import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { Luvball } from '@/components/Luvball';
import { useAuth } from '@/lib/auth';
import {
  buyLuvball,
  getLuvballStatus,
  getNotifications,
  markRead,
  timeAgo,
  type AppNotification,
  type LuvballStatus,
} from '@/lib/luvballs';
import { colors, fonts } from '@/lib/theme';

/** Your Luvball stash, gold coins, referral code, and anonymous "someone threw at you" alerts. */
export default function Luvballs() {
  const { session, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [status, setStatus] = useState<LuvballStatus | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      (async () => {
        try {
          const [all, st] = await Promise.all([getNotifications(), getLuvballStatus()]);
          const received = all.filter((n) => n.type === 'luvball_received');
          setItems(received);
          setStatus(st);
          await markRead(received.filter((n) => !n.read_at).map((n) => n.id));
        } catch {
          setItems([]);
        }
      })();
    }, [session]),
  );

  if (!loading && !session) return <Redirect href="/welcome" />;

  const email = session?.user.email ?? '';

  const buy = async () => {
    setBuying(true);
    setBuyMsg(null);
    try {
      setStatus(await buyLuvball());
      setBuyMsg('🎉 You bought a Luvball!');
    } catch (e) {
      setBuyMsg(e instanceof Error ? e.message : 'Could not buy. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  const copyCode = async () => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // the code is shown on screen anyway
    }
  };

  const canBuy = !!status && status.coins >= status.price && status.remaining < status.max;
  const nextFree = status?.next_free_at
    ? new Date(status.next_free_at).toLocaleDateString([], { day: 'numeric', month: 'short' })
    : null;

  return (
    <DeviceFrame footer={<ShellButton variant="ghost" label="← Back to Radar" onPress={() => router.replace('/radar')} />}>
      <Text style={styles.kicker}>LUVBALLS & GOLD</Text>

      {/* Stash */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Luvball size={54} />
          <View style={{ flex: 1 }}>
            <Text style={styles.big}>
              {status ? `${status.remaining} of ${status.max}` : '…'} Luvballs
            </Text>
            <Text style={styles.body}>
              {status?.remaining === status?.max
                ? 'Your stash is full.'
                : nextFree
                  ? `+1 free Luvball on ${nextFree}. You get one every month.`
                  : 'You get 1 free Luvball every month.'}
            </Text>
          </View>
        </View>
        {status ? (
          <View style={styles.dots}>
            {Array.from({ length: status.max }, (_, i) => (
              <View key={i} style={[styles.dot, i < status.remaining && styles.dotFull]} />
            ))}
          </View>
        ) : null}
      </View>

      {/* Coins */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.coinIcon}>🪙</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.big}>{status ? status.coins : '…'} gold coins</Text>
            <Text style={styles.body}>1 Luvball costs {status?.price ?? 300} coins.</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={buy}
          disabled={!canBuy || buying}
          style={[styles.buy, (!canBuy || buying) && styles.buyOff]}
        >
          <Text style={[styles.buyText, (!canBuy || buying) && styles.buyTextOff]}>
            {buying ? 'Buying…' : `Buy 1 Luvball for ${status?.price ?? 300} 🪙`}
          </Text>
        </Pressable>
        {status && !canBuy && !buyMsg ? (
          <Text style={styles.hint}>
            {status.remaining >= status.max
              ? 'Your stash is full (12 max).'
              : `You need ${status.price - status.coins} more coins. Invite friends to earn them.`}
          </Text>
        ) : null}
        {buyMsg ? <Text style={styles.hint}>{buyMsg}</Text> : null}
      </View>

      {/* Referral */}
      <View style={[styles.card, styles.referral]}>
        <Text style={styles.cardTitle}>🎁 Invite friends, earn coins</Text>
        <Text style={styles.body}>
          When a friend creates their Luvdex Entry and enters your referral code, you both get 🪙 100 gold coins.
        </Text>
        <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Copy referral code" onPress={copyCode} style={styles.code}>
          <Text style={styles.codeText} numberOfLines={1}>
            {email}
          </Text>
          <Text style={styles.copy}>{copied ? 'Copied ✓' : 'Copy'}</Text>
        </Pressable>
        <Text style={styles.hint}>
          {status ? `${status.referrals} friend${status.referrals === 1 ? '' : 's'} joined with your code.` : ''}
        </Text>
      </View>

      {/* Received */}
      <Text style={styles.section}>Thrown at you</Text>
      {items === null ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 20 }} />
      ) : items.length === 0 ? (
        <Text style={styles.body}>No Luvballs yet. The more you're on the Radar, the more people can find you.</Text>
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
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 12, borderWidth: 2, borderColor: colors.screenEdge, marginBottom: 10, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink },
  big: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  hint: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.screenEdge, backgroundColor: colors.cream },
  dotFull: { backgroundColor: colors.lensPink, borderColor: colors.luvRed },
  coinIcon: { fontSize: 40, width: 54, textAlign: 'center' },
  buy: { alignSelf: 'stretch', minHeight: 46, borderRadius: 23, backgroundColor: colors.sparkYellow, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#D9A900' },
  buyOff: { backgroundColor: colors.cream, borderBottomColor: 'transparent' },
  buyText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  buyTextOff: { color: colors.inkSoft },
  referral: { borderColor: colors.sparkYellow, backgroundColor: '#FFFBEA' },
  codeLabel: { fontFamily: fonts.pixelBold, fontSize: 10, color: colors.inkSoft, marginTop: 4 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 10, borderWidth: 2, borderColor: colors.screenEdge, paddingHorizontal: 12, paddingVertical: 10 },
  codeText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  copy: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.luvRed },
  section: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink, marginTop: 10, marginBottom: 8 },
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
