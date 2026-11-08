import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { useAuth } from '@/lib/auth';
import {
  MOVES,
  formatClock,
  getContest,
  moveEmoji,
  respondChallenge,
  secondsLeft,
  submitMove,
  type Contest,
  type Move,
} from '@/lib/contests';
import { useAppActive } from '@/lib/useAppActive';
import { getNotifications, markRead } from '@/lib/luvballs';
import { colors, fonts } from '@/lib/theme';

const POLL_MS = 3_000;

/** One rock-paper-scissors contest. Your rival stays anonymous. */
export default function ContestScreen() {
  const active = useAppActive();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, loading } = useAuth();
  const [contest, setContest] = useState<Contest | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setContest(await getContest(String(id)));
    } catch {
      setContest((prev) => prev ?? null);
    }
  }, [id]);

  useEffect(() => {
    if (!session || !active) return;
    load();
    // Mark this contest's alerts as read.
    getNotifications()
      .then((all) =>
        markRead(all.filter((n) => n.type === 'contest' && !n.read_at && n.payload.contest_id === id).map((n) => n.id)),
      )
      .catch(() => undefined);
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [session, id, active, load]);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const act = async (fn: () => Promise<Contest>) => {
    setBusy(true);
    setError(null);
    try {
      setContest(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      load();
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/luvballs'));

  return (
    <DeviceFrame lensOn={!!contest && !contest.result} footer={<ShellButton variant="ghost" label="← Back" onPress={back} />}>
      <Text style={styles.kicker}>⚔️ LUVBALL CONTEST</Text>
      {contest === undefined ? (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 40 }} />
      ) : contest === null ? (
        <Text style={styles.body}>This contest isn't available.</Text>
      ) : (
        <ContestBody
          c={contest}
          secs={secondsLeft(contest.deadline_at, now)}
          busy={busy}
          confirmReject={confirmReject}
          onAccept={() => act(() => respondChallenge(contest.id, true))}
          onReject={() => (confirmReject ? act(() => respondChallenge(contest.id, false)) : setConfirmReject(true))}
          onCancelReject={() => setConfirmReject(false)}
          onMove={(m) => act(() => submitMove(contest.id, m))}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </DeviceFrame>
  );
}

function ContestBody({
  c,
  secs,
  busy,
  confirmReject,
  onAccept,
  onReject,
  onCancelReject,
  onMove,
}: {
  c: Contest;
  secs: number;
  busy: boolean;
  confirmReject: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancelReject: () => void;
  onMove: (m: Move) => void;
}) {
  const header = (
    <>
      <Text style={styles.title}>For {c.target_name}'s heart 💘</Text>
      <Text style={styles.body}>
        You and an anonymous rival both threw a Luvball at {c.target_name} within an hour. Only one Luvball can stand.
      </Text>
    </>
  );

  // Finished or cancelled
  if (c.result) {
    const moves =
      c.last_my_move && c.last_rival_move ? (
        <View style={styles.versus}>
          <MoveBadge label="You" move={c.last_my_move} />
          <Text style={styles.vs}>vs</Text>
          <MoveBadge label="Rival" move={c.last_rival_move} />
        </View>
      ) : null;
    return (
      <>
        {header}
        {moves}
        <View style={[styles.result, c.result === 'won' ? styles.resultWon : c.result === 'lost' ? styles.resultLost : null]}>
          <Text style={styles.resultTitle}>
            {c.result === 'won' ? '🏆 You won!' : c.result === 'lost' ? '💔 You lost' : 'Contest cancelled'}
          </Text>
          <Text style={styles.resultText}>
            {c.result === 'won'
              ? c.kind === 'playoff'
                ? `Next you'll challenge the person who threw at ${c.target_name} first. Watch for the alert!`
                : `Your Luvball at ${c.target_name} stands.`
              : c.result === 'lost'
                ? `${reasonText(c.reason)} Your Luvball at ${c.target_name} is no longer valid. Throw another one to contest again.`
                : 'No penalty: your Luvball still stands.'}
          </Text>
        </View>
      </>
    );
  }

  // Waiting for the holder to accept
  if (c.status === 'pending') {
    if (c.must_accept) {
      return (
        <>
          {header}
          <Clock secs={secs} label="to answer" />
          <Text style={styles.body}>
            Someone threw a Luvball at {c.target_name} after you and wants to play rock-paper-scissors for it. If you reject or
            don't answer in time, your Luvball becomes useless.
          </Text>
          {!confirmReject ? (
            <View style={styles.actions}>
              <BigButton label="⚔️ Accept challenge" onPress={onAccept} disabled={busy} primary />
              <BigButton label="Reject (give up my Luvball)" onPress={onReject} disabled={busy} />
            </View>
          ) : (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>Rejecting means you forfeit: your Luvball at {c.target_name} becomes useless.</Text>
              <View style={styles.actions}>
                <BigButton label="Yes, reject" onPress={onReject} disabled={busy} />
                <BigButton label="No, go back" onPress={onCancelReject} disabled={busy} primary />
              </View>
            </View>
          )}
        </>
      );
    }
    return (
      <>
        {header}
        <Clock secs={secs} label="for them to answer" />
        <Text style={styles.body}>
          Someone threw at {c.target_name} before you. We've challenged them. If they reject or don't answer in time, your Luvball
          wins automatically.
        </Text>
      </>
    );
  }

  // Playing
  return (
    <>
      {header}
      <Text style={styles.round}>ROUND {c.round}</Text>
      {c.round > 1 && c.last_my_move ? (
        <Text style={styles.tie}>
          Last round was a tie: you both picked {moveEmoji(c.last_my_move)}. Go again!
        </Text>
      ) : null}
      <Clock secs={secs} label="to pick" />
      {c.my_move ? (
        <View style={styles.waiting}>
          <Text style={styles.waitingMove}>{moveEmoji(c.my_move)}</Text>
          <Text style={styles.body}>
            You picked {c.my_move}. {c.rival_moved ? 'Revealing…' : 'Waiting for your rival to pick…'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.body}>Pick your move. Your rival can't see it until you've both chosen.</Text>
          <View style={styles.moves}>
            {MOVES.map((m) => (
              <Pressable
                key={m.value}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                onPress={() => onMove(m.value)}
                disabled={busy}
                style={({ pressed }) => [styles.move, pressed && { transform: [{ scale: 0.95 }] }, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.moveEmoji}>{m.emoji}</Text>
                <Text style={styles.moveLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          {c.rival_moved ? <Text style={styles.hint}>Your rival has already picked. Your turn!</Text> : null}
        </>
      )}
    </>
  );
}

function reasonText(reason: string | null) {
  switch (reason) {
    case 'rejected':
      return 'You rejected the challenge.';
    case 'timeout_accept':
      return "You didn't answer the challenge in time.";
    case 'timeout_move':
      return "You didn't pick a move in time.";
    case 'both_timeout':
      return 'Neither of you picked in time.';
    default:
      return 'Your rival won.';
  }
}

function Clock({ secs, label }: { secs: number; label: string }) {
  return (
    <View style={[styles.clock, secs <= 60 && styles.clockUrgent]}>
      <Text style={[styles.clockTime, secs <= 60 && styles.clockTimeUrgent]}>⏱ {formatClock(secs)}</Text>
      <Text style={styles.clockLabel}>{label}</Text>
    </View>
  );
}

function MoveBadge({ label, move }: { label: string; move: Move }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeEmoji}>{moveEmoji(move)}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

function BigButton({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.big, primary ? styles.bigPrimary : styles.bigQuiet, disabled && { opacity: 0.6 }]}
    >
      <Text style={[styles.bigText, primary ? styles.bigTextPrimary : styles.bigTextQuiet]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 8 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, marginTop: 6 },
  hint: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.luvRed, marginTop: 10, textAlign: 'center' },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.luvRed, marginTop: 12 },
  round: { fontFamily: fonts.pixelBold, fontSize: 13, color: colors.luvRed, marginTop: 16, letterSpacing: 1 },
  tie: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginTop: 4 },
  clock: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 8, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: colors.screenEdge },
  clockUrgent: { borderColor: colors.luvRed, backgroundColor: '#FFF0F2' },
  clockTime: { fontFamily: fonts.bodyHeavy, fontSize: 22, color: colors.ink },
  clockTimeUrgent: { color: colors.luvRed },
  clockLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft },
  moves: { flexDirection: 'row', gap: 10, marginTop: 14 },
  move: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.lensPink },
  moveEmoji: { fontSize: 40 },
  moveLabel: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink, marginTop: 4 },
  waiting: { alignItems: 'center', marginTop: 16, gap: 4 },
  waitingMove: { fontSize: 64 },
  actions: { gap: 10, marginTop: 14 },
  confirm: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.luvRed },
  confirmText: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.ink },
  big: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  bigPrimary: { backgroundColor: colors.luvRed, borderBottomWidth: 4, borderBottomColor: colors.deepShell },
  bigQuiet: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.screenEdge },
  bigText: { fontFamily: fonts.bodyHeavy, fontSize: 16, textAlign: 'center' },
  bigTextPrimary: { color: colors.white },
  bigTextQuiet: { color: colors.ink },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  vs: { fontFamily: fonts.pixelBold, fontSize: 14, color: colors.inkSoft },
  badge: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 2, borderColor: colors.screenEdge },
  badgeEmoji: { fontSize: 44 },
  badgeLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  result: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.screenEdge, gap: 4 },
  resultWon: { borderColor: colors.sparkYellow, backgroundColor: '#FFFBEA' },
  resultLost: { borderColor: colors.luvRed, backgroundColor: '#FFF0F2' },
  resultTitle: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  resultText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
});
