// Admin: everything admins have changed, newest first.
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { A, Btn, ErrorNote, Loading, Row, s } from '@/components/admin/ui';
import { ago, describe, getActivity, type ActivityItem } from '@/lib/admin';
import { fonts } from '@/lib/theme';

export default function AdminActivity() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getActivity(300));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the log.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ gap: 12 }}>
      <Row>
        <Text style={[s.h1, { flex: 1 }]}>Activity log</Text>
        <Btn label="Refresh" small onPress={load} />
      </Row>
      <Text style={s.muted}>Every ban, balance change, photo action, report decision and setting change. Kept for 1 year.</Text>
      <ErrorNote text={error} />
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Text style={[s.muted, { padding: 20 }]}>Nothing yet.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((g) => (
            <View key={g.id} style={styles.row}>
              <Text style={[s.muted, styles.when]}>{ago(g.at)}</Text>
              <Text style={[s.bold, styles.who]} numberOfLines={1}>
                {g.admin ?? g.admin_email ?? 'admin'}
              </Text>
              <View style={styles.what}>
                <Text style={s.text}>{describe(g.action, g.details)}</Text>
                {g.target_id ? (
                  <Pressable onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: g.target_id! } })}>
                    <Text style={styles.target}>{`→ ${g.target_name ?? 'user'}`}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, overflow: 'hidden' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: A.line },
  when: { width: 90 },
  who: { width: 110 },
  what: { flex: 1, minWidth: 220, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  target: { fontFamily: fonts.bodyBold, fontSize: 14, color: A.red },
});
