import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/lib/theme';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField(props: TextInputProps & { invalid?: boolean }) {
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor="#8A90A3"
      {...rest}
      style={[styles.input, invalid && styles.inputInvalid, props.multiline && styles.multiline, style]}
    />
  );
}

type Option<T extends string> = { value: T; label: string; color?: string };

/** Single-choice chips. Tap the selected chip again to clear it when `clearable`. */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  clearable,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  clearable?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Chip
            key={o.value}
            label={o.label}
            selected={selected}
            color={o.color}
            onPress={() => onChange(selected && clearable ? null : o.value)}
          />
        );
      })}
    </View>
  );
}

/** Multi-choice chips with an optional maximum. */
export function ChipMulti({
  options,
  values,
  onChange,
  max,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const selected = values.includes(o);
        const full = !!max && values.length >= max && !selected;
        return (
          <Chip
            key={o}
            label={o}
            selected={selected}
            disabled={full}
            onPress={() => onChange(selected ? values.filter((v) => v !== o) : [...values, o])}
          />
        );
      })}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  color,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const accent = color ?? colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        selected && { backgroundColor: accent, borderColor: accent },
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}
        >
          <Text style={[styles.segmentText, o.value === value && styles.segmentTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export const formStyles = StyleSheet.create({
  stepTitle: { fontFamily: fonts.bodyHeavy, fontSize: 24, lineHeight: 30, color: colors.ink },
  stepIntro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.inkSoft, marginTop: 4, marginBottom: 6 },
  group: { marginTop: 16 },
  row: { flexDirection: 'row', gap: 10 },
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  hint: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.inkSoft },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.screenEdge,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.ink,
  },
  inputInvalid: { borderColor: colors.luvRed },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.screenEdge,
    backgroundColor: colors.white,
  },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  chipTextSelected: { color: colors.white },
  segmented: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, padding: 4, borderWidth: 2, borderColor: colors.screenEdge },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  segmentTextOn: { color: colors.white },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.luvRed, marginTop: 10 },
});
