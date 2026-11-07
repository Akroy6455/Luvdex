import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { signOut, useAuth } from '@/lib/auth';
import { useDevice } from '@/lib/device';
import { colors, fonts } from '@/lib/theme';

/** Shows the app only if this account is allowed on this device (max 2 accounts per device). */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { status, recheck } = useDevice();

  if (!session) return <>{children}</>;

  if (status === 'idle' || status === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.cream} />
      </View>
    );
  }

  if (status === 'blocked') {
    return (
      <DeviceFrame
        footer={
          <>
            <ShellButton label="Sign out" onPress={signOut} />
            <ShellButton variant="ghost" label="Check again" onPress={recheck} />
          </>
        }
      >
        <Text style={styles.kicker}>ONE PHONE, TWO ACCOUNTS</Text>
        <Text style={styles.title}>This device already has 2 Luvdex accounts</Text>
        <Text style={styles.body}>
          To keep Luvdex fair and free of fake profiles, each phone or browser can be used by at most 2 accounts.
        </Text>
        <Text style={styles.body}>
          Sign out and use one of your existing accounts on this device. A space frees up if one of those accounts is deleted, or
          hasn't been used for 30 days.
        </Text>
        <Text style={styles.small}>Signed in as {session.user.email}</Text>
      </DeviceFrame>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deepShell },
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 8 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: 10 },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft, marginTop: 16 },
});
