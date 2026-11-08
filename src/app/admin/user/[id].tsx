// Admin: one user's full picture and every action in one place.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { A, Badge, Btn, Card, ErrorNote, Field, Loading, Row, s } from '@/components/admin/ui';
import {
  REPORT_REASON_LABEL,
  adjustWallet,
  ago,
  describe,
  getUser,
  setBan,
  setPhotoStatus,
  setReportStatus,
  type AdminUserDetail,
} from '@/lib/admin';
import { fonts } from '@/lib/theme';

type Currency = 'luvballs' | 'flares' | 'coins';
const CURRENCIES: { key: Currency; label: string; icon: string; steps: number[] }[] = [
  { key: 'luvballs', label: 'Luvballs', icon: '♥', steps: [1, 5] },
  { key: 'flares', label: 'Flares', icon: '🔥', steps: [1, 5] },
  { key: 'coins', label: 'Gold coins', icon: '🪙', steps: [100, 300] },
];

export default function AdminUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState<Record<Currency, string>>({ luvballs: '', flares: '', coins: '' });
  const [confirmBan, setConfirmBan] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setUser(await getUser(String(id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this user.');
      setUser(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (done) setFlash(done);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(null);
    }
  };

  const change = (c: Currency, delta: number) => {
    if (!user || !delta) return;
    act(`${c}${delta}`, () => adjustWallet(user.id, { [c]: delta }, reason), `${delta > 0 ? '+' : ''}${delta} ${c} saved`);
  };

  if (user === undefined) return <Loading />;
  if (user === null) {
    return (
      <View style={{ gap: 10 }}>
        <ErrorNote text={error ?? 'User not found.'} />
        <Btn label="← Back to users" onPress={() => router.replace('/admin/users')} />
      </View>
    );
  }

  const p = user.profile;
  const banned = !!p?.is_banned;

  return (
    <View style={{ gap: 14 }}>
      <Row wrap>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/users'))}>
          <Text style={styles.back}>← Users</Text>
        </Pressable>
      </Row>

      {/* Header */}
      <Card>
        <Row wrap gap={10}>
          {user.photos[0]?.url ? <Image source={{ uri: user.photos[0].url }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
          <View style={{ flex: 1, minWidth: 220, gap: 3 }}>
            <Row wrap gap={6}>
              <Text style={s.h1}>
                {p?.first_name ?? '(no Entry yet)'}
                {user.age ? `, ${user.age}` : ''}
              </Text>
              {banned ? <Badge label="Banned" tone="red" /> : null}
              {p?.is_paused ? <Badge label="Paused" /> : null}
              {user.is_admin ? <Badge label="Admin" tone="blue" /> : null}
              {user.kind !== 'real' ? <Badge label={user.kind === 'demo' ? 'Demo Entry' : 'Reviewer'} tone="orange" /> : null}
            </Row>
            <Text style={s.text} selectable>
              {user.email ?? '—'} · {user.provider ?? '—'} sign-in
            </Text>
            <Text style={s.muted} selectable>
              {`ID ${user.id}`}
            </Text>
            <Text style={s.muted}>
              {`Joined ${ago(user.created_at)} · last sign-in ${ago(user.last_sign_in_at)} · location ${user.location_seen_at ? `${ago(user.location_seen_at)} (±${user.location_accuracy_m} m)` : 'none'}`}
            </Text>
          </View>
          <View style={{ gap: 6, alignItems: 'flex-end' }}>
            {!confirmBan ? (
              <Btn
                label={banned ? 'Unban' : 'Ban user'}
                tone={banned ? 'success' : 'danger'}
                onPress={() => (banned ? act('ban', () => setBan(user.id, false, reason), 'Unbanned') : setConfirmBan(true))}
                busy={busy === 'ban'}
                disabled={!p}
              />
            ) : (
              <Row>
                <Btn
                  label="Yes, ban"
                  tone="danger"
                  busy={busy === 'ban'}
                  onPress={() => {
                    setConfirmBan(false);
                    act('ban', () => setBan(user.id, true, reason), 'Banned: hidden everywhere, location removed');
                  }}
                />
                <Btn label="Cancel" tone="ghost" onPress={() => setConfirmBan(false)} />
              </Row>
            )}
          </View>
        </Row>
        <Field value={reason} onChangeText={setReason} placeholder="Reason / note for the activity log (optional, used for bans and balance changes)" />
        {flash ? <Text style={styles.flash}>{`✓ ${flash}`}</Text> : null}
        <ErrorNote text={error} />
      </Card>

      <View style={styles.cols}>
        {/* Left column */}
        <View style={styles.col}>
          <Card title="Balances">
            {user.wallet ? (
              CURRENCIES.map((c) => (
                <View key={c.key} style={styles.walletRow}>
                  <Text style={[s.bold, { width: 110 }]}>{`${c.icon} ${c.label}`}</Text>
                  <Text style={styles.walletValue}>{user.wallet![c.key].toLocaleString()}</Text>
                  <Row wrap gap={4}>
                    {[...c.steps].reverse().map((n) => (
                      <Btn key={`-${n}`} label={`−${n}`} small onPress={() => change(c.key, -n)} busy={busy === `${c.key}${-n}`} />
                    ))}
                    {c.steps.map((n) => (
                      <Btn key={`+${n}`} label={`+${n}`} small onPress={() => change(c.key, n)} busy={busy === `${c.key}${n}`} />
                    ))}
                    <Field
                      value={custom[c.key]}
                      onChangeText={(v) => setCustom((prev) => ({ ...prev, [c.key]: v.replace(/[^0-9-]/g, '') }))}
                      placeholder="±"
                      keyboardType="numbers-and-punctuation"
                      style={styles.customInput}
                      onSubmitEditing={() => {
                        change(c.key, parseInt(custom[c.key], 10) || 0);
                        setCustom((prev) => ({ ...prev, [c.key]: '' }));
                      }}
                    />
                    <Btn
                      label="Apply"
                      small
                      tone="primary"
                      disabled={!parseInt(custom[c.key], 10)}
                      onPress={() => {
                        change(c.key, parseInt(custom[c.key], 10) || 0);
                        setCustom((prev) => ({ ...prev, [c.key]: '' }));
                      }}
                    />
                  </Row>
                </View>
              ))
            ) : (
              <Text style={s.muted}>No wallet yet (they haven't finished their Entry).</Text>
            )}
            {user.wallet ? (
              <Text style={s.muted}>
                {`Next free Luvball ${new Date(user.wallet.next_luvball_at).toLocaleDateString()} · next free Flare ${new Date(user.wallet.next_flare_at).toLocaleDateString()}. Monthly top-ups stop at 12; admins can give up to 999.`}
              </Text>
            ) : null}
          </Card>

          <Card title={`Photos (${user.photos.length})`}>
            {user.photos.length === 0 ? <Text style={s.muted}>No photos.</Text> : null}
            <Row wrap gap={10}>
              {user.photos.map((ph) => (
                <View key={ph.id} style={styles.photoBox}>
                  {ph.url ? <Image source={{ uri: ph.url }} style={[styles.photo, ph.status === 'rejected' && { opacity: 0.35 }]} /> : <View style={[styles.photo, styles.avatarEmpty]} />}
                  <Row gap={4}>
                    <Badge label={ph.status} tone={ph.status === 'rejected' ? 'red' : ph.status === 'approved' ? 'green' : 'grey'} />
                  </Row>
                  {ph.status === 'rejected' ? (
                    <Btn label="Restore" small onPress={() => act(`ph${ph.id}`, () => setPhotoStatus(ph.id, 'approved'), 'Photo restored')} busy={busy === `ph${ph.id}`} />
                  ) : (
                    <Btn label="Hide photo" small tone="danger" onPress={() => act(`ph${ph.id}`, () => setPhotoStatus(ph.id, 'rejected'), 'Photo hidden from others')} busy={busy === `ph${ph.id}`} />
                  )}
                </View>
              ))}
            </Row>
          </Card>

          <Card title={`Reports about them (${user.reports_about.length})`}>
            {user.reports_about.length === 0 ? <Text style={s.muted}>None.</Text> : null}
            {user.reports_about.map((r) => (
              <View key={r.id} style={styles.report}>
                <Row wrap gap={6}>
                  <Text style={s.bold}>{REPORT_REASON_LABEL[r.reason] ?? r.reason}</Text>
                  <Badge label={r.status} tone={r.status === 'open' ? 'amber' : 'grey'} />
                  <Text style={s.muted}>{`by ${r.reporter_name ?? 'deleted user'} · ${ago(r.created_at)}`}</Text>
                </Row>
                {r.details ? <Text style={s.text}>{r.details}</Text> : null}
                {r.status === 'open' ? (
                  <Row gap={6}>
                    <Btn label="Mark reviewed" small onPress={() => act(`r${r.id}`, () => setReportStatus(r.id, 'reviewed'))} busy={busy === `r${r.id}`} />
                    <Btn label="Dismiss" small tone="ghost" onPress={() => act(`r${r.id}`, () => setReportStatus(r.id, 'dismissed'))} />
                  </Row>
                ) : null}
              </View>
            ))}
          </Card>
        </View>

        {/* Right column */}
        <View style={styles.col}>
          <Card title="Activity">
            <View style={styles.kv}>
              {(
                [
                  ['Matches', user.counts.matches],
                  ['Messages sent', user.counts.messages_sent],
                  ['Luvballs thrown (90 d)', user.counts.throws_90d],
                  ['Luvballs still out', user.counts.luvballs_out],
                  ['Flares fired', user.counts.flares_fired],
                  ['Referrals', user.counts.referrals],
                  ['Reports made', user.counts.reports_made],
                  ['Blocked others', user.counts.blocks_made],
                  ['Blocked by', user.counts.blocked_by],
                  ['Devices', user.counts.devices],
                  ['Notification devices', user.counts.push],
                ] as const
              ).map(([k, v]) => (
                <View key={k} style={styles.kvRow}>
                  <Text style={s.muted}>{k}</Text>
                  <Text style={s.bold}>{v}</Text>
                </View>
              ))}
            </View>
          </Card>

          {p ? (
            <Card title="Entry">
              <View style={styles.kv}>
                {(
                  [
                    ['Gender', p.gender],
                    ['Born', p.birthdate],
                    ['Looking for', p.looking_for.replace(/_/g, ' ')],
                    ['Height / weight', `${p.height_cm} cm · ${p.weight_kg} kg`],
                    ['Education', [p.education_level, p.school].filter(Boolean).join(' · ') || '—'],
                    ['Work', [p.job_title, p.company].filter(Boolean).join(' · ') || '—'],
                    ['Habits', `drinks ${p.drinking ?? '—'} · smokes ${p.smoking ?? '—'}`],
                    ['Visible at', `${p.visibility_min_m}–${p.visibility_max_m} m`],
                    ['Interests', p.interests.join(', ') || '—'],
                    ['Languages', p.languages.join(', ') || '—'],
                  ] as const
                ).map(([k, v]) => (
                  <View key={k} style={styles.kvRow}>
                    <Text style={s.muted}>{k}</Text>
                    <Text style={[s.text, { flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
                  </View>
                ))}
              </View>
              {p.bio ? <Text style={[s.text, styles.bio]}>{p.bio}</Text> : null}
            </Card>
          ) : null}

          <Card title="Admin history">
            {user.admin_log.length === 0 ? <Text style={s.muted}>No admin actions yet.</Text> : null}
            {user.admin_log.map((g, i) => (
              <Text key={i} style={s.muted}>
                {`${ago(g.at)} · ${g.admin ?? 'admin'} · ${describe(g.action, g.details)}`}
              </Text>
            ))}
          </Card>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: fonts.bodyBold, fontSize: 14, color: A.red },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEmpty: { backgroundColor: '#EEEBE6' },
  flash: { fontFamily: fonts.bodyBold, fontSize: 13, color: A.green },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  col: { flexGrow: 1, flexBasis: 420, minWidth: 300, gap: 14 },
  walletRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: A.line },
  walletValue: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: A.ink, width: 70 },
  customInput: { width: 70, paddingVertical: 4, minHeight: 28 },
  photoBox: { gap: 6, alignItems: 'flex-start' },
  photo: { width: 120, height: 150, borderRadius: 8 },
  report: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.line },
  kv: { gap: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  bio: { marginTop: 6, padding: 10, backgroundColor: '#FAF7F3', borderRadius: 8 },
});
