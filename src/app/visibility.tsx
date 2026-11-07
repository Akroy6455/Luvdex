import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { ErrorText, FieldLabel, Segmented, formStyles } from '@/components/Form';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { clearMyLocation } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

const FROM = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450];
const TO = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

/** Visibility band (who can see you, by distance) and Ghost mode. */
export default function Visibility() {
  const { session, loading } = useAuth();
  const { profile, setProfile } = useProfile();
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(500);
  const [ghost, setGhost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setMin(profile.visibility_min_m);
    setMax(profile.visibility_max_m);
    setGhost(profile.is_paused);
  }, [profile]);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!session || !profile) return <DeviceFrame><Text style={styles.body}>Loading…</Text></DeviceFrame>;

  const pickMin = (v: number) => {
    setMin(v);
    if (max <= v) setMax(v + 50);
  };
  const pickMax = (v: number) => {
    setMax(v);
    if (min >= v) setMin(v - 50);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const saved = await updateProfile(session.user.id, { visibility_min_m: min, visibility_max_m: max, is_paused: ghost });
      if (ghost) await clearMyLocation(); // disappear straight away, not after 15 minutes
      setProfile(saved);
      router.replace('/radar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <DeviceFrame
      footer={
        <>
          <ShellButton label="Save visibility" onPress={save} busy={saving} />
          <ShellButton variant="ghost" label="Cancel" onPress={() => router.replace('/radar')} />
        </>
      }
    >
      <Text style={formStyles.stepTitle}>Visibility</Text>
      <Text style={formStyles.stepIntro}>
        Choose at what distances people can see you. It's fair both ways: you only see people at the same distances.
      </Text>

      <View style={formStyles.group}>
        <FieldLabel>Ghost mode</FieldLabel>
        <Segmented
          options={[
            { value: 'off', label: 'Visible' },
            { value: 'on', label: '👻 Ghost' },
          ]}
          value={ghost ? 'on' : 'off'}
          onChange={(v) => setGhost(v === 'on')}
        />
        {ghost ? <Text style={styles.note}>Nobody will see you, and you won't see anyone, until you switch back.</Text> : null}
      </View>

      {!ghost ? (
        <>
          <View style={formStyles.group}>
            <FieldLabel>Visible from</FieldLabel>
            <DistanceChips values={FROM} selected={min} onPick={pickMin} />
          </View>
          <View style={formStyles.group}>
            <FieldLabel>Visible up to</FieldLabel>
            <DistanceChips values={TO} selected={max} onPick={pickMax} />
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              People {min}–{max} m away can see you, and you can see people {min}–{max} m away.
            </Text>
          </View>

          {min > 50 ? (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>⚠️ No Luvballs with this setting</Text>
              <Text style={styles.warningText}>
                Luvballs can only be thrown within 50 m. Starting your band at {min} m means nobody can throw one at you, and you
                can't throw either.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
    </DeviceFrame>
  );
}

function DistanceChips({ values, selected, onPick }: { values: number[]; selected: number; onPick: (v: number) => void }) {
  return (
    <View style={styles.chips}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: v === selected }}
          onPress={() => onPick(v)}
          style={[styles.chip, v === selected && styles.chipOn]}
        >
          <Text style={[styles.chipText, v === selected && styles.chipTextOn]}>{v} m</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minWidth: 62, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 2, borderColor: colors.screenEdge, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  chipTextOn: { color: colors.white },
  summary: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.screenEdge },
  summaryText: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: colors.ink },
  warning: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#FFF4D6', borderWidth: 2, borderColor: colors.sparkYellow },
  warningTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  warningText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
});
