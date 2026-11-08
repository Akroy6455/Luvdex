// Admin: app settings, the blocked-word list, and app-review tools.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { A, Btn, Card, Chip, ErrorNote, Field, Loading, Row, s } from '@/components/admin/ui';
import {
  addBlockedTerm,
  getSettings,
  listBlockedTerms,
  removeBlockedTerm,
  resetReviewWorld,
  setSetting,
} from '@/lib/admin';
import { fonts } from '@/lib/theme';

const SETTINGS: { key: string; label: string; help: string; unit: string }[] = [
  { key: 'throw_range_m', label: 'Throw range', help: 'How close you must be to throw a Luvball.', unit: 'm' },
  { key: 'location_max_accuracy_m', label: 'Roughest location accepted', help: '100000 = any location is used as if exact. 150 = strict.', unit: 'm' },
  { key: 'throw_gps_max_m', label: 'Roughest location to throw from', help: '100000 = no limit. 75 = strict.', unit: 'm' },
  { key: 'flare_radius_m', label: 'Flare reach', help: 'How far a Flare reaches.', unit: 'm' },
  { key: 'flare_max_recipients', label: 'People per Flare', help: 'Most people one Flare reaches (nearest first).', unit: 'people' },
  { key: 'flare_minutes', label: 'Flare duration', help: 'How long a Flare stays lit.', unit: 'min' },
];
const CATEGORIES = ['profanity', 'sexual', 'solicitation', 'hate', 'abuse_hindi'];

export default function AdminSettings() {
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.h1}>Settings</Text>
      <AppSettings />
      <BlockedWords />
      <ReviewTools />
    </View>
  );
}

function AppSettings() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const v = await getSettings();
      setValues(v);
      setDraft(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load settings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key: string) => {
    setBusy(key);
    setError(null);
    setSaved(null);
    try {
      await setSetting(key, Number(draft[key]));
      setSaved(key);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="App settings">
      {!values ? (
        <Loading />
      ) : (
        SETTINGS.map((st) => {
          const changed = draft[st.key] !== values[st.key];
          return (
            <View key={st.key} style={styles.settingRow}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={s.bold}>{st.label}</Text>
                <Text style={s.muted}>{st.help}</Text>
              </View>
              <Row gap={6}>
                <Field
                  value={draft[st.key] ?? ''}
                  onChangeText={(v) => setDraft((d) => ({ ...d, [st.key]: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="numeric"
                  style={{ width: 100, textAlign: 'right' }}
                  onSubmitEditing={() => changed && save(st.key)}
                />
                <Text style={[s.muted, { width: 46 }]}>{st.unit}</Text>
                <Btn label={saved === st.key && !changed ? 'Saved ✓' : 'Save'} small tone={changed ? 'primary' : 'plain'} disabled={!changed} busy={busy === st.key} onPress={() => save(st.key)} />
              </Row>
            </View>
          );
        })
      )}
      <ErrorNote text={error} />
      <Text style={s.muted}>Changes apply straight away for everyone and are recorded in the Activity log.</Text>
    </Card>
  );
}

function BlockedWords() {
  const [terms, setTerms] = useState<{ term: string; category: string }[] | null>(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('profanity');
  const [newTerm, setNewTerm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTerms(await listBlockedTerms());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocked words.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (terms ?? []).filter((t) => !filter || t.term.includes(filter.toLowerCase())),
    [terms, filter],
  );

  const add = async () => {
    if (!newTerm.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await addBlockedTerm(newTerm, category);
      setNewTerm('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (term: string) => {
    setBusy(term);
    try {
      await removeBlockedTerm(term);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={`Blocked words${terms ? ` (${terms.length})` : ''}`}>
      <Text style={s.muted}>
        Names, bios, work/school and chat messages containing these whole words are refused. Simple disguises (fuuuck, sh1t, f.u.c.k) are caught automatically.
      </Text>
      <Row wrap gap={6}>
        <Field value={newTerm} onChangeText={setNewTerm} placeholder="Add a word or phrase" autoCapitalize="none" style={{ flex: 1, minWidth: 180 }} onSubmitEditing={add} />
        <Btn label="Add" tone="primary" onPress={add} busy={busy === 'add'} disabled={!newTerm.trim()} />
      </Row>
      <Row wrap gap={6}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c.replace('_', ' ')} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </Row>
      <ErrorNote text={error} />
      <Field value={filter} onChangeText={setFilter} placeholder="Filter the list…" autoCapitalize="none" />
      {!terms ? (
        <Loading />
      ) : (
        <View style={styles.terms}>
          {shown.map((t) => (
            <Pressable key={t.term} onPress={() => remove(t.term)} style={styles.term} accessibilityLabel={`Remove ${t.term}`}>
              <Text style={styles.termText}>{busy === t.term ? '…' : t.term}</Text>
              <Text style={styles.termX}>✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={s.muted}>Tap a word to remove it.</Text>
    </Card>
  );
}

function ReviewTools() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="App review">
      <Text style={s.muted}>
        Before every App Store or Google Play submission, give the reviewer account (appreview@review.luvdex.com) a fresh start: its matches, Luvballs and alerts are cleared and its stash refilled.
      </Text>
      <Row>
        <Btn
          label="Reset review accounts"
          tone="primary"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              setResult(await resetReviewWorld());
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not reset.');
            } finally {
              setBusy(false);
            }
          }}
        />
        {result ? <Text style={styles.ok}>{`✓ ${result}`}</Text> : null}
      </Row>
      <ErrorNote text={error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  settingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: A.line },
  terms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  term: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2EFEA', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  termText: { fontFamily: fonts.bodyBold, fontSize: 13, color: A.ink },
  termX: { fontSize: 11, color: A.faint },
  ok: { fontFamily: fonts.bodyBold, fontSize: 13, color: A.green },
});
