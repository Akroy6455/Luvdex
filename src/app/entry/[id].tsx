import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { EntryCard } from '@/components/EntryCard';
import { ErrorText, FieldLabel, TextField } from '@/components/Form';
import { MatchCelebration } from '@/components/MatchCelebration';
import { ThrowPanel } from '@/components/ThrowPanel';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, blockUser, reportUser, unmatch, type ReportReason, type ThrowResult } from '@/lib/luvballs';
import { useProfile } from '@/lib/profile';
import { BAND_LABEL, distanceAway, getEntry, minutesLeft, type OtherEntry } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

type Panel = null | 'block' | 'report' | 'unmatch';

/** Someone else's Entry. Opens while they're (recently) on your Radar, or if you've matched. */
export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, loading } = useAuth();
  const { profile } = useProfile();
  const [entry, setEntry] = useState<OtherEntry | null | undefined>(undefined);
  const [celebrate, setCelebrate] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!session || !id) return;
    getEntry(String(id))
      .then(setEntry)
      .catch(() => setEntry(null));
  }, [session, id]);

  useEffect(load, [load]);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/radar'));

  const onThrowResult = (r: ThrowResult) => {
    if (r.result === 'match') setCelebrate(true);
    load();
  };

  const runAction = async (action: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      after();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const matched = !!entry?.match_id;

  return (
    <DeviceFrame
      lensOn={!!entry && (entry.in_range || matched)}
      footer={
        <>
          {entry && !matched ? <ThrowPanel entry={entry} onResult={onThrowResult} /> : null}
          {entry && matched ? (
            <View style={styles.matchedBox}>
              <Text style={styles.matchedTitle}>💞 You caught each other</Text>
              <ShellButton
                label={`💬 Chat with ${entry.first_name}`}
                onPress={() => router.push({ pathname: '/chat/[matchId]', params: { matchId: entry.match_id! } })}
              />
            </View>
          ) : null}
          <ShellButton variant="ghost" label="← Back" onPress={back} />
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
              {entry.in_range ? '♥ Within Luvball range' : BAND_LABEL[entry.distance_band]}
            </Text>
          ) : null}
          {entry.flare ? (
            <Text style={styles.flare}>
              {`🔥 Fired a Flare · ${distanceAway(entry.flare.distance_m)} · ${minutesLeft(entry.flare.expires_at)}`}
            </Text>
          ) : null}
          <EntryCard profile={entry} photos={entry.photos} units={profile?.units ?? 'metric'} />

          {/* Safety */}
          <View style={styles.safety}>
            {panel === null ? (
              <View style={styles.safetyRow}>
                {matched ? <SafetyLink label="Unmatch" onPress={() => setPanel('unmatch')} /> : null}
                <SafetyLink label="Block" onPress={() => setPanel('block')} />
                <SafetyLink label="Report" onPress={() => setPanel('report')} />
              </View>
            ) : null}

            {panel === 'unmatch' ? (
              <Confirm
                title={`Unmatch ${entry.first_name}?`}
                text="You'll disappear from each other's Caught list. You can still see each other on the Radar."
                confirmLabel="Unmatch"
                busy={busy}
                onCancel={() => setPanel(null)}
                onConfirm={() => runAction(() => unmatch(entry.match_id!), () => router.replace('/caught'))}
              />
            ) : null}

            {panel === 'block' ? (
              <Confirm
                title={`Block ${entry.first_name}?`}
                text="You'll both disappear from each other's Radar for good, and any Luvballs or match between you are removed. They won't be told."
                confirmLabel="Block"
                busy={busy}
                onCancel={() => setPanel(null)}
                onConfirm={() => runAction(() => blockUser(entry.id), () => router.replace('/radar'))}
              />
            ) : null}

            {panel === 'report' ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>Report {entry.first_name}</Text>
                <Text style={styles.body}>Reports are private. We'll also block them for you.</Text>
                <View style={styles.reasons}>
                  {REPORT_REASONS.map((r) => (
                    <Pressable
                      key={r.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: reason === r.value }}
                      onPress={() => setReason(r.value)}
                      style={[styles.reason, reason === r.value && styles.reasonOn]}
                    >
                      <Text style={[styles.reasonText, reason === r.value && styles.reasonTextOn]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <FieldLabel hint="Optional">What happened?</FieldLabel>
                <TextField value={details} onChangeText={(t) => setDetails(t.slice(0, 500))} multiline placeholder="Anything that helps us review this" />
                <View style={styles.confirmButtons}>
                  <ShellButton
                    label="Send report"
                    busy={busy}
                    disabled={!reason}
                    onPress={() => runAction(() => reportUser(entry.id, reason!, details), () => router.replace('/radar'))}
                  />
                  <ShellButton variant="primary" label="Cancel" onPress={() => setPanel(null)} />
                </View>
              </View>
            ) : null}
            <ErrorText>{actionError}</ErrorText>
          </View>
        </>
      )}

      <MatchCelebration
        visible={celebrate}
        name={entry?.first_name ?? ''}
        onView={() => setCelebrate(false)}
        onClose={() => {
          setCelebrate(false);
          router.replace('/radar');
        }}
      />
    </DeviceFrame>
  );
}

function SafetyLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.safetyLink}>
      <Text style={styles.safetyLinkText}>{label}</Text>
    </Pressable>
  );
}

function Confirm({
  title,
  text,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmTitle}>{title}</Text>
      <Text style={styles.body}>{text}</Text>
      <View style={styles.confirmButtons}>
        <ShellButton label={confirmLabel} onPress={onConfirm} busy={busy} />
        <ShellButton variant="primary" label="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 8 },
  band: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft, marginBottom: 10 },
  flare: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: '#FFF1E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  bandInRange: { color: colors.luvRed },
  gone: { marginVertical: 30, gap: 6 },
  goneTitle: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  matchedBox: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 10 },
  matchedTitle: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.luvRed, textAlign: 'center' },
  matchedText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink, textAlign: 'center' },
  safety: { marginTop: 18, paddingTop: 12, borderTopWidth: 2, borderTopColor: colors.screenEdge },
  safetyRow: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  safetyLink: { paddingVertical: 6 },
  safetyLinkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft, textDecorationLine: 'underline' },
  confirm: { gap: 8, backgroundColor: colors.cream, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: colors.screenEdge },
  confirmTitle: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: colors.ink },
  confirmButtons: { gap: 8, marginTop: 4 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  reason: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 2, borderColor: colors.screenEdge, backgroundColor: colors.white },
  reasonOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  reasonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  reasonTextOn: { color: colors.white },
});
