// Email + password sign-in for App Store / Google Play reviewers only.
// The server accepts email sign-in only for accounts @review.luvdex.com that the admin
// created; everyone else signs in with Google or Apple on the Welcome screen.
import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { ErrorText, FieldLabel, TextField } from '@/components/Form';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function ReviewerSignIn() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const submit = async () => {
    setError(null);
    const address = email.trim().toLowerCase();
    if (!address.endsWith('@review.luvdex.com')) {
      setError('This sign-in is only for app review accounts. Please use Google or Apple on the previous screen.');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (signInError) setError('That email and password didn’t match a review account.');
  };

  return (
    <DeviceFrame
      footer={
        <>
          <ShellButton label="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
          <Link href="/welcome" style={styles.back}>
            ← Back to Google / Apple sign-in
          </Link>
        </>
      }
    >
      <Text style={styles.kicker}>APP REVIEW</Text>
      <Text style={styles.title}>Reviewer sign-in</Text>
      <Text style={styles.body}>
        {'For the App Store and Google Play review teams. Use the demo account from the review notes. ' +
          'It shows clearly labelled demo Entries around your location, so you can try the Radar, ' +
          'throwing a Luvball, matching and chat without anyone nearby.'}
      </Text>
      <View style={styles.form}>
        <FieldLabel>Email</FieldLabel>
        <TextField
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="name@review.luvdex.com"
        />
        <FieldLabel>Password</FieldLabel>
        <TextField
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={submit}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
      </View>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 26, color: colors.ink, marginTop: 8 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, marginTop: 8 },
  form: { marginTop: 16, gap: 6 },
  back: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.cream, textAlign: 'center', textDecorationLine: 'underline' },
});
