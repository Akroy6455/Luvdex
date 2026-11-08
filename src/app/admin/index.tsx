// Admin dashboard: key numbers and the last 14 days.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { A, Btn, Card, ErrorNote, Loading, Row, Stat, s } from '@/components/admin/ui';
import { ago, getStats, type AdminStats, type DayStat } from '@/lib/admin';
import { fonts } from '@/lib/theme';

const SERIES: { key: keyof Omit<DayStat, 'day'>; label: string; color: string }[] = [
  { key: 'signups', label: 'New users', color: A.blue },
  { key: 'throws', label: 'Luvballs thrown', color: A.red },
  { key: 'matches', label: 'Matches', color: '#B83280' },
  { key: 'messages', label: 'Messages', color: A.green },
  { key: 'flares', label: 'Flares fired', color: A.orange },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setStats(await getStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load numbers.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!stats) return error ? <ErrorNote text={error} /> : <Loading />;

  const goUsers = (which: string) => router.push({ pathname: '/admin/users', params: { which } });

  return (
    <View style={{ gap: 16 }}>
      <Row>
        <Text style={[s.h1, { flex: 1 }]}>Dashboard</Text>
        <Text style={s.muted}>Updated {ago(stats.generated_at)}</Text>
        <Btn label="Refresh" small onPress={load} busy={busy} />
      </Row>
      <ErrorNote text={error} />

      {stats.open_reports > 0 ? (
        <Pressable onPress={() => router.push('/admin/reports')} style={styles.alert}>
          <Text style={styles.alertText}>
            {`⚠️ ${stats.open_reports} open report${stats.open_reports === 1 ? '' : 's'} waiting. Review them →`}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>People</Text>
      <View style={styles.grid}>
        <Stat label="Entries" value={stats.users_total} sub={`${stats.men} men · ${stats.women} women`} />
        <Stat label="New today" value={stats.new_today} sub={`${stats.new_7d} in 7 days`} tone="green" />
        <Stat label="Active 24 h" value={stats.active_24h} sub={`${stats.active_7d} in 7 days`} />
        <Stat label="On Radar now" value={stats.on_radar_now} sub="last 15 minutes" />
        <Stat label="Sign-up unfinished" value={stats.users_incomplete} sub="no Entry yet" />
        <Pressable style={styles.statLink} onPress={() => goUsers('banned')}>
          <Stat label="Banned" value={stats.banned} sub={`${stats.paused} paused`} tone={stats.banned ? 'red' : undefined} />
        </Pressable>
      </View>

      <Text style={styles.section}>Activity</Text>
      <View style={styles.grid}>
        <Stat label="Luvballs thrown" value={stats.throws_today} sub={`today · ${stats.throws_7d} in 7 days`} />
        <Stat label="Matches" value={stats.matches_today} sub={`today · ${stats.matches_7d} in 7 days · ${stats.matches_total} total`} />
        <Stat label="Messages" value={stats.messages_today} sub={`today · ${stats.messages_7d} in 7 days`} />
        <Stat label="Flares" value={stats.flares_today} sub={`today · ${stats.flares_7d} in 7 days · ${stats.flares_lit_now} lit now`} />
        <Stat label="Open reports" value={stats.open_reports} tone={stats.open_reports ? 'red' : 'green'} />
        <Stat label="Notifications on" value={stats.push_devices} sub="browsers + phones" />
      </View>

      <Text style={styles.section}>Economy</Text>
      <View style={styles.grid}>
        <Stat label="Luvballs held" value={stats.luvballs_total} sub="all users" />
        <Stat label="Flares held" value={stats.flares_total} sub="all users" />
        <Stat label="Gold coins held" value={stats.coins_total} sub="all users" />
        <Stat label="Referrals" value={stats.referrals_total} sub="all time" />
      </View>

      <Text style={styles.section}>Last 14 days</Text>
      <View style={styles.charts}>
        {SERIES.map((series) => (
          <BarChart key={series.key} data={stats.series} field={series.key} label={series.label} color={series.color} />
        ))}
      </View>
      <Text style={s.muted}>Demo Entries and the app-review account are left out of every number.</Text>
    </View>
  );
}

function BarChart({ data, field, label, color }: { data: DayStat[]; field: keyof Omit<DayStat, 'day'>; label: string; color: string }) {
  const max = Math.max(1, ...data.map((d) => d[field]));
  const total = data.reduce((sum, d) => sum + d[field], 0);
  return (
    <View style={styles.chartBox}>
      <Card title={label} right={<Text style={s.muted}>{`${total} total`}</Text>}>
        <View style={styles.bars}>
          {data.map((d) => (
            <View key={d.day} style={styles.barCol}>
              <Text style={styles.barValue}>{d[field] || ''}</Text>
              <View style={[styles.bar, { height: Math.max(2, (d[field] / max) * 90), backgroundColor: d[field] ? color : A.line }]} />
              <Text style={styles.barDay}>{new Date(d.day + 'T00:00:00').getDate()}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: A.soft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statLink: { flexGrow: 1, flexBasis: 150, minWidth: 150 },
  alert: { backgroundColor: A.redSoft, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F5C2CA' },
  alertText: { fontFamily: fonts.bodyBold, fontSize: 14, color: A.red },
  charts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chartBox: { flexGrow: 1, flexBasis: 340, minWidth: 280 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 130 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barValue: { fontFamily: fonts.bodyBold, fontSize: 10, color: A.soft, marginBottom: 2 },
  barDay: { fontFamily: fonts.body, fontSize: 10, color: A.faint, marginTop: 4 },
});
