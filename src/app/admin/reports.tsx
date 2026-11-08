// Admin: the reports queue. Act on each report in one click.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { A, Badge, Btn, Chip, ErrorNote, Loading, Row, s } from '@/components/admin/ui';
import { REPORT_REASON_LABEL, ago, listReports, setBan, setReportStatus, type AdminReport } from '@/lib/admin';
import { fonts } from '@/lib/theme';

const STATUSES: { value: AdminReport['status'] | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];
const URGENT = new Set(['underage', 'safety_concern']);

export default function AdminReports() {
  const [status, setStatus] = useState<AdminReport['status'] | 'all'>('open');
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listReports(status));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reports.');
    }
  }, [status]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(null);
    }
  };

  // Urgent reasons first, then newest.
  const sorted = rows ? [...rows].sort((a, b) => Number(URGENT.has(b.reason)) - Number(URGENT.has(a.reason))) : null;

  return (
    <View style={{ gap: 12 }}>
      <Row>
        <Text style={[s.h1, { flex: 1 }]}>Reports</Text>
        <Btn label="Refresh" small onPress={load} />
      </Row>
      <Row wrap gap={6}>
        {STATUSES.map((st) => (
          <Chip key={st.value} label={st.label} active={status === st.value} onPress={() => setStatus(st.value)} />
        ))}
      </Row>
      <Text style={s.muted}>
        People reported by 3 different users within 30 days are hidden automatically until you decide. "Seems under 18" and "Safety concern" are shown first.
      </Text>
      <ErrorNote text={error} />
      {!sorted ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Text style={[s.muted, { padding: 20 }]}>{status === 'open' ? '🎉 No open reports.' : 'Nothing here.'}</Text>
      ) : (
        sorted.map((r) => (
          <View key={r.id} style={[styles.card, URGENT.has(r.reason) && r.status === 'open' && styles.urgent]}>
            <Row wrap gap={6}>
              <Text style={s.bold}>{REPORT_REASON_LABEL[r.reason] ?? r.reason}</Text>
              <Badge label={r.status} tone={r.status === 'open' ? 'amber' : 'grey'} />
              {r.reporters_30d >= 2 ? <Badge label={`${r.reporters_30d} people reported them (30 d)`} tone="red" /> : null}
              {r.reported_banned ? <Badge label="Banned" tone="red" /> : null}
              <Text style={[s.muted, { marginLeft: 'auto' }]}>{ago(r.created_at)}</Text>
            </Row>
            <Row wrap gap={4}>
              <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.reported_id } })}>
                <Text style={styles.person}>{r.reported_name ?? 'deleted user'}</Text>
              </Pressable>
              <Text style={s.muted}>reported by</Text>
              <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.reporter_id } })}>
                <Text style={styles.personSoft}>{r.reporter_name ?? 'deleted user'}</Text>
              </Pressable>
            </Row>
            {r.details ? <Text style={[s.text, styles.details]}>{r.details}</Text> : null}
            <Row wrap gap={6}>
              <Btn label="Open profile" small onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: r.reported_id } })} />
              {!r.reported_banned ? (
                <Btn
                  label="Ban user"
                  small
                  tone="danger"
                  busy={busy === `ban${r.id}`}
                  onPress={() => act(`ban${r.id}`, () => setBan(r.reported_id, true, `Report: ${REPORT_REASON_LABEL[r.reason] ?? r.reason}`))}
                />
              ) : null}
              {r.status !== 'reviewed' ? (
                <Btn label="Mark reviewed" small busy={busy === `rev${r.id}`} onPress={() => act(`rev${r.id}`, () => setReportStatus(r.id, 'reviewed'))} />
              ) : null}
              {r.status !== 'dismissed' ? (
                <Btn label="Dismiss" small tone="ghost" busy={busy === `dis${r.id}`} onPress={() => act(`dis${r.id}`, () => setReportStatus(r.id, 'dismissed'))} />
              ) : null}
              {r.status !== 'open' ? (
                <Btn label="Reopen" small tone="ghost" onPress={() => act(`open${r.id}`, () => setReportStatus(r.id, 'open'))} />
              ) : null}
            </Row>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 14, gap: 8 },
  urgent: { borderColor: A.red, borderWidth: 2 },
  person: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: A.red },
  personSoft: { fontFamily: fonts.bodyBold, fontSize: 14, color: A.blue },
  details: { backgroundColor: '#FAF7F3', borderRadius: 8, padding: 10 },
});
