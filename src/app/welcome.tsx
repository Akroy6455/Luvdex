import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppleSignInButton } from '@/components/AppleSignInButton';
import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { Luvball } from '@/components/Luvball';
import { SignInCancelled, signInWithApple, signInWithGoogle, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Welcome() {
  const { session, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(authError);

  if (session) return <Redirect href="/" />;

  const run = async (signIn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await signIn(); // website: the browser leaves for Google here; apps: a sign-in sheet opens
      if (Platform.OS !== 'web') setBusy(false);
    } catch (e) {
      if (!(e instanceof SignInCancelled)) {
        setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
      }
      setBusy(false);
    }
  };

  return (
    <DeviceFrame
      footer={
        <>
          <AppleSignInButton onPress={() => run(signInWithApple)} disabled={busy || !isSupabaseConfigured} />
          <ShellButton
            variant="google"
            label="Continue with Google"
            onPress={() => run(signInWithGoogle)}
            busy={busy}
            disabled={!isSupabaseConfigured}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.legal}>
            Luvdex is for adults 18+. By continuing you agree to our{' '}
            <Link href="/terms" style={styles.legalLink}>
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" style={styles.legalLink}>
              Privacy Policy
            </Link>
            .
          </Text>
          <Link href="/reviewer-sign-in" style={styles.reviewer}>
            App reviewer? Sign in with email
          </Link>
        </>
      }
    >
      <Text style={styles.entryNo}>No. 000 · NEW ENTRY</Text>
      <View style={styles.hero}>
        <Luvball size={104} />
      </View>
      <Text style={styles.title}>Catch feelings nearby.</Text>
      <Text style={styles.body}>
        Spot people within 500 m, get within 50 m, and throw a Luvball. If they throw one back, it's a match.
      </Text>

      {!isSupabaseConfigured ? (
        <View style={styles.setup}>
          <Text style={styles.setupTitle}>SETUP NEEDED</Text>
          <Text style={styles.setupBody}>
            Luvdex isn't connected to its backend yet. Add the Supabase keys described in docs/PHASE0_SETUP.md.
          </Text>
        </View>
      ) : null}
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  entryNo: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  hero: { alignItems: 'center', marginVertical: 24 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 28, lineHeight: 34, color: colors.ink, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.inkSoft, textAlign: 'center', marginTop: 10 },
  setup: {
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.sparkYellow,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  setupTitle: { fontFamily: fonts.pixelBold, fontSize: 12, color: colors.ink, marginBottom: 4 },
  setupBody: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white, textAlign: 'center' },
  legal: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.cream, textAlign: 'center', opacity: 0.9 },
  legalLink: { fontFamily: fonts.bodyBold, textDecorationLine: 'underline', color: colors.cream },
  reviewer: { fontFamily: fonts.body, fontSize: 12, color: colors.cream, textAlign: 'center', opacity: 0.75, textDecorationLine: 'underline' },
});
