// Admin: find any user fast (search by name, email or ID), filter, and open their page.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { A, Badge, Btn, Chip, ErrorNote, Field, Loading, Row, s } from '@/components/admin/ui';
import { ago, listUsers, type AdminUserRow, type UserFilter } from '@/lib/admin';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'reported', label: 'Reported' },
  { value: 'banned', label: 'Banned' },
  { value: 'paused', label: 'Paused' },
  { value: 'incomplete', label: 'No Entry yet' },
  { value: 'admins', label: 'Admins' },
  { value: 'review', label: 'Review & demo' },
];
const PAGE = 50;

export default function AdminUsers() {
  const params = useLocalSearchParams<{ which?: string; q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [which, setWhich] = useState<UserFilter>((params.which as UserFilter) || 'all');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; rows: AdminUserRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const reqId = useRef(0);

  // Search as you type (waits 250 ms after the last key).
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await listUsers(q, which, PAGE, page * PAGE);
        if (id === reqId.current) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (id === reqId.current) setError(e instanceof Error ? e.message : 'Could not load users.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, which, page]);

  const open = (id: string) => router.push({ pathname: '/admin/user/[id]', params: { id } });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <View style={{ gap: 12 }}>
      <Row>
        <Text style={[s.h1, { flex: 1 }]}>Users</Text>
        <Text style={s.muted}>{data ? `${data.total.toLocaleString()} found` : ''}</Text>
      </Row>
      <Field
        value={q}
        onChangeText={(v) => {
          setQ(v);
          setPage(0);
        }}
        placeholder="Search name, email or user ID…"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => data?.rows.length === 1 && open(data.rows[0].id)}
      />
      <Row wrap gap={6}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            active={which === f.value}
            onPress={() => {
              setWhich(f.value);
              setPage(0);
            }}
          />
        ))}
      </Row>
      <ErrorNote text={error} />

      {!data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <Text style={[s.muted, { padding: 20 }]}>No users match.</Text>
      ) : wide ? (
        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[s.th, styles.cName]}>User</Text>
            <Text style={[s.th, styles.cSmall]}>Age</Text>
            <Text style={[s.th, styles.cNum]}>Luvballs</Text>
            <Text style={[s.th, styles.cNum]}>Flares</Text>
            <Text style={[s.th, styles.cNum]}>Coins</Text>
            <Text style={[s.th, styles.cDate]}>Last active</Text>
            <Text style={[s.th, styles.cDate]}>Joined</Text>
            <Text style={[s.th, styles.cTags]}>Status</Text>
          </View>
          {data.rows.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => open(u.id)}
              style={({ hovered }: { hovered?: boolean }) => [styles.tr, hovered && { backgroundColor: '#FAF7F3' }]}
            >
              <View style={styles.cName}>
                <Text style={s.bold} numberOfLines={1}>
                  {u.first_name ?? '(no Entry)'} {u.gender ? (u.gender === 'man' ? '♂' : '♀') : ''}
                </Text>
                <Text style={s.muted} numberOfLines={1}>
                  {u.email ?? u.id}
                </Text>
              </View>
              <Text style={[s.text, styles.cSmall]}>{u.age ?? '—'}</Text>
              <Text style={[s.text, styles.cNum]}>{u.luvballs ?? '—'}</Text>
              <Text style={[s.text, styles.cNum]}>{u.flares ?? '—'}</Text>
              <Text style={[s.text, styles.cNum]}>{u.coins ?? '—'}</Text>
              <Text style={[s.muted, styles.cDate]}>{ago(u.last_active)}</Text>
              <Text style={[s.muted, styles.cDate]}>{ago(u.created_at)}</Text>
              <View style={[styles.cTags, styles.tags]}>
                <Tags u={u} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {data.rows.map((u) => (
            <Pressable key={u.id} onPress={() => open(u.id)} style={styles.card}>
              <Row>
                <Text style={[s.bold, { flex: 1 }]} numberOfLines={1}>
                  {u.first_name ?? '(no Entry)'}
                  {u.age ? `, ${u.age}` : ''} {u.gender ? (u.gender === 'man' ? '♂' : '♀') : ''}
                </Text>
                <Text style={s.muted}>{ago(u.last_active)}</Text>
              </Row>
              <Text style={s.muted} numberOfLines={1}>
                {u.email}
              </Text>
              <Row wrap gap={6}>
                <Text style={s.muted}>{`♥ ${u.luvballs ?? 0} · 🔥 ${u.flares ?? 0} · 🪙 ${u.coins ?? 0}`}</Text>
                <Tags u={u} />
              </Row>
            </Pressable>
          ))}
        </View>
      )}

      {data && pages > 1 ? (
        <Row>
          <Btn label="← Previous" small disabled={page === 0} onPress={() => setPage((p) => p - 1)} />
          <Text style={s.muted}>{`Page ${page + 1} of ${pages}`}</Text>
          <Btn label="Next →" small disabled={page + 1 >= pages} onPress={() => setPage((p) => p + 1)} />
        </Row>
      ) : null}
      {loading && data ? <Text style={s.muted}>Updating…</Text> : null}
    </View>
  );
}

function Tags({ u }: { u: AdminUserRow }) {
  return (
    <>
      {u.is_banned ? <Badge label="Banned" tone="red" /> : null}
      {u.open_reports > 0 ? <Badge label={`${u.open_reports} report${u.open_reports === 1 ? '' : 's'}`} tone="amber" /> : null}
      {u.is_paused ? <Badge label="Paused" /> : null}
      {!u.onboarding_done ? <Badge label="No Entry" /> : null}
      {u.is_admin ? <Badge label="Admin" tone="blue" /> : null}
      {u.kind !== 'real' ? <Badge label={u.kind === 'demo' ? 'Demo' : 'Reviewer'} tone="orange" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  table: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, overflow: 'hidden' },
  thead: { backgroundColor: '#FAF7F3' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: A.line,
    gap: 10,
  },
  cName: { flex: 3, minWidth: 0 },
  cSmall: { width: 44 },
  cNum: { width: 70, textAlign: 'right' },
  cDate: { width: 100 },
  cTags: { flex: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  card: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 12, gap: 4 },
});
