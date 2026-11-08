// Small building blocks for the admin panel: a plain, dense, desktop-friendly look.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { fonts } from '@/lib/theme';

export const A = {
  bg: '#F5F2EE',
  card: '#FFFFFF',
  line: '#E6E0D8',
  ink: '#1B1E2B',
  soft: '#5F6577',
  faint: '#9AA0AE',
  red: '#E23A4E',
  redSoft: '#FDE8EB',
  green: '#1F9D63',
  greenSoft: '#E3F5EC',
  amber: '#B7791F',
  amberSoft: '#FDF3E1',
  blue: '#2B6CB0',
  blueSoft: '#E6EFFA',
  orange: '#FF7A1A',
};

export function Card({ children, title, right, pad = true }: { children: ReactNode; title?: string; right?: ReactNode; pad?: boolean }) {
  return (
    <View style={[s.card, !pad && { padding: 0 }]}>
      {title || right ? (
        <View style={[s.cardHead, !pad && { paddingHorizontal: 14, paddingTop: 12 }]}>
          {title ? <Text style={s.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'red' | 'green' | 'amber' }) {
  const color = tone === 'red' ? A.red : tone === 'green' ? A.green : tone === 'amber' ? A.amber : A.ink;
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

type BtnTone = 'primary' | 'danger' | 'ghost' | 'success' | 'plain';

export function Btn({
  label,
  onPress,
  tone = 'plain',
  busy,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  tone?: BtnTone;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const bg = { primary: A.ink, danger: A.red, success: A.green, ghost: 'transparent', plain: A.card }[tone];
  const fg = tone === 'plain' || tone === 'ghost' ? A.ink : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, borderColor: tone === 'plain' ? A.line : bg },
        tone === 'ghost' && { borderColor: 'transparent' },
        (pressed || hovered) && { opacity: 0.85 },
        (disabled || busy) && { opacity: 0.45 },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Text style={[s.btnText, small && s.btnTextSmall, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Badge({ label, tone = 'grey' }: { label: string; tone?: 'grey' | 'red' | 'green' | 'amber' | 'blue' | 'orange' }) {
  const map = {
    grey: ['#EEEBE6', A.soft],
    red: [A.redSoft, A.red],
    green: [A.greenSoft, A.green],
    amber: [A.amberSoft, A.amber],
    blue: [A.blueSoft, A.blue],
    orange: ['#FFF1E6', A.orange],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={A.faint} {...props} style={[s.input, props.style]} />;
}

export function Chip({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && s.chipTextOn]}>
        {label}
        {count !== undefined ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={A.red} />
    </View>
  );
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return <Text style={s.error}>{text}</Text>;
}

export function Row({ children, gap = 8, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>;
}

export const s = StyleSheet.create({
  card: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: A.ink },
  stat: {
    backgroundColor: A.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: A.line,
    padding: 12,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: 150,
  },
  statLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: A.soft, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontFamily: fonts.bodyHeavy, fontSize: 26, marginTop: 2 },
  statSub: { fontFamily: fonts.body, fontSize: 12, color: A.faint, marginTop: 2 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 4, minHeight: 28 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  btnTextSmall: { fontSize: 13 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: A.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: A.ink,
    backgroundColor: '#fff',
    minHeight: 36,
  },
  chip: { borderWidth: 1, borderColor: A.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: A.card },
  chipOn: { backgroundColor: A.ink, borderColor: A.ink },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: A.soft },
  chipTextOn: { color: '#fff' },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: A.red },
  h1: { fontFamily: fonts.bodyHeavy, fontSize: 22, color: A.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, color: A.soft },
  text: { fontFamily: fonts.body, fontSize: 14, color: A.ink },
  bold: { fontFamily: fonts.bodyBold, fontSize: 14, color: A.ink },
  th: { fontFamily: fonts.bodyBold, fontSize: 12, color: A.soft, textTransform: 'uppercase', letterSpacing: 0.3 },
});
