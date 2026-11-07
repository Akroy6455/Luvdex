import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { ErrorText, FieldLabel, formStyles } from '@/components/Form';
import { useAuth } from '@/lib/auth';
import { LOOKING_FOR, formatHeight, formatWeight, type LookingFor, type Units } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences, type Preferences } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';

/** Scanner settings: who you want to see. Filters work both ways. */
export default function Scanner() {
  const { session, loading } = useAuth();
  const { profile } = useProfile();
  const units: Units = profile?.units ?? 'metric';
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) getPreferences(session.user.id).then(setPrefs).catch(() => setPrefs(DEFAULT_PREFERENCES));
  }, [session]);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!prefs || !session) return <DeviceFrame><Text style={styles.body}>Loading…</Text></DeviceFrame>;

  const set = (patch: Partial<Preferences>) => setPrefs({ ...prefs, ...patch });
  const toggleType = (t: LookingFor) => {
    const has = prefs.looking_for_filter.includes(t);
    set({ looking_for_filter: has ? prefs.looking_for_filter.filter((x) => x !== t) : [...prefs.looking_for_filter, t] });
  };

  const save = async () => {
    if (!prefs.looking_for_filter.length) {
      setError('Choose at least one type to see.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await savePreferences(session.user.id, prefs);
      router.replace('/radar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  const heightStep = units === 'metric' ? 5 : 2.54 * 2;
  const weightStep = units === 'metric' ? 5 : 4.536; // 10 lb

  return (
    <DeviceFrame
      footer={
        <>
          <ShellButton label="Save scanner settings" onPress={save} busy={saving} />
          <ShellButton variant="ghost" label="Reset to everyone" onPress={() => setPrefs(DEFAULT_PREFERENCES)} />
          <ShellButton variant="ghost" label="Cancel" onPress={() => router.replace('/radar')} />
        </>
      }
    >
      <Text style={formStyles.stepTitle}>Scanner settings</Text>
      <Text style={formStyles.stepIntro}>
        Choose who shows up on your Radar. Filters work both ways: you only see people whose own filters include you.
      </Text>

      <RangeRow
        label="Age"
        min={prefs.age_min}
        max={prefs.age_max}
        limits={[18, 99]}
        step={1}
        format={(v) => (v >= 99 ? '99+' : String(v))}
        onChange={(age_min, age_max) => set({ age_min, age_max })}
      />
      <RangeRow
        label="Height"
        min={prefs.height_min}
        max={prefs.height_max}
        limits={[120, 230]}
        step={heightStep}
        format={(v) => formatHeight(v, units)}
        onChange={(height_min, height_max) => set({ height_min, height_max })}
      />
      <RangeRow
        label="Weight"
        min={prefs.weight_min}
        max={prefs.weight_max}
        limits={[30, 250]}
        step={weightStep}
        format={(v) => formatWeight(v, units)}
        onChange={(weight_min, weight_max) => set({ weight_min, weight_max })}
      />

      <View style={formStyles.group}>
        <FieldLabel>Looking for</FieldLabel>
        <View style={styles.chips}>
          {LOOKING_FOR.map((t) => {
            const on = prefs.looking_for_filter.includes(t.value);
            return (
              <Pressable
                key={t.value}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggleType(t.value)}
                style={[styles.chip, on && { backgroundColor: t.color, borderColor: t.color }]}
              >
                <Text style={[styles.chipText, on && { color: colors.white }]}>{on ? '✓ ' : ''}{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
    </DeviceFrame>
  );
}

/** A min–max range with − / + steppers. Values are stored in years, cm or kg. */
function RangeRow({
  label,
  min,
  max,
  limits,
  step,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  limits: [number, number];
  step: number;
  format: (v: number) => string;
  onChange: (min: number, max: number) => void;
}) {
  const clamp = (v: number) => Math.round(Math.min(limits[1], Math.max(limits[0], v)));
  return (
    <View style={formStyles.group}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.rangeRow}>
        <Stepper
          caption="From"
          value={format(min)}
          onMinus={() => onChange(clamp(min - step), max)}
          onPlus={() => onChange(Math.min(clamp(min + step), max), max)}
        />
        <Stepper
          caption="To"
          value={format(max)}
          onMinus={() => onChange(min, Math.max(clamp(max - step), min))}
          onPlus={() => onChange(min, clamp(max + step))}
        />
      </View>
    </View>
  );
}

function Stepper({ caption, value, onMinus, onPlus }: { caption: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption} decrease`} onPress={onMinus} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={styles.stepCaption}>{caption.toUpperCase()}</Text>
        <Text style={styles.stepValue}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption} increase`} onPress={onPlus} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  rangeRow: { flexDirection: 'row', gap: 8 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, borderWidth: 2, borderColor: colors.screenEdge, padding: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.screenMint, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink, lineHeight: 24 },
  stepCaption: { fontFamily: fonts.pixel, fontSize: 9, color: colors.inkSoft },
  stepValue: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 2, borderColor: colors.screenEdge, backgroundColor: colors.white },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
});
