import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { signOut, useAuth } from '@/lib/auth';
import { useDevice } from '@/lib/device';
import { colors, fonts } from '@/lib/theme';

/**
 * Enforces "max 2 accounts per device". The app underneath always stays mounted:
 * while the check runs (or if the device is full) a cover is drawn on top instead of
 * replacing the app. Replacing it would reset navigation, so opening a direct link
 * such as /admin or a notification link would land on the home screen instead.
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { status, recheck } = useDevice();
  const checking = (!!session && (status === 'idle' || status === 'checking'));
  const blocked = !!session && status === 'blocked';

  return (
    <View style={styles.fill}>
      {children}
      {checking ? (
        <View style={[StyleSheet.absoluteFill, styles.loading]}>
          <ActivityIndicator color={colors.cream} />
        </View>
      ) : null}
      {blocked && session ? (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { backgroundColor: colors.deepShell, zIndex: 20 },
  loading: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deepShell, zIndex: 20 },
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 8 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 22, lineHeight: 28, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: 10 },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft, marginTop: 16 },
});
