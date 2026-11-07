import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'google' | 'primary' | 'ghost';
};

export function ShellButton({ label, onPress, disabled, busy, variant = 'primary' }: Props) {
  const isGoogle = variant === 'google';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        isGoogle && styles.google,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isGoogle ? colors.ink : colors.white} />
      ) : (
        <Text style={[styles.label, isGoogle && styles.googleLabel, variant === 'ghost' && styles.ghostLabel]}>
          {isGoogle ? <Text style={styles.g}>G  </Text> : null}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  primary: { backgroundColor: colors.ink, borderBottomColor: '#0B0D14' },
  google: { backgroundColor: colors.white, borderBottomColor: '#D9D9D9' },
  ghost: { backgroundColor: 'transparent', borderBottomWidth: 0, minHeight: 40 },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.white },
  googleLabel: { color: colors.ink },
  ghostLabel: { color: colors.cream, fontFamily: fonts.bodyBold, fontSize: 14, textDecorationLine: 'underline' },
  g: { fontFamily: fonts.bodyHeavy, color: '#4285F4' },
});
