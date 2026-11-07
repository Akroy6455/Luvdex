import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { ErrorText, FieldLabel, Segmented, TextField } from '@/components/Form';
import { signOut, useAuth } from '@/lib/auth';
import { deleteMyAccount, updateProfile, type Units } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { colors, fonts } from '@/lib/theme';

export default function Account() {
  const { session, loading } = useAuth();
  const { profile, setProfile } = useProfile();
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const changeUnits = async (units: Units) => {
    if (!session || !profile || units === profile.units) return;
    setUnitsError(null);
    try {
      setProfile(await updateProfile(session.user.id, { units }));
    } catch {
      setUnitsError('Could not save. Please try again.');
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      setProfile(null);
      router.replace('/welcome');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <DeviceFrame
      footer={<ShellButton variant="ghost" label="← Back to my Entry" onPress={() => router.replace('/me')} />}
    >
      <Text style={styles.kicker}>ACCOUNT & SETTINGS</Text>
      <Text style={styles.email}>Signed in as {session?.user.email}</Text>

      {profile ? (
        <View style={styles.block}>
          <FieldLabel>Units</FieldLabel>
          <Segmented
            options={[
              { value: 'metric', label: 'cm · kg' },
              { value: 'imperial', label: 'ft · lb' },
            ]}
            value={profile.units}
            onChange={changeUnits}
          />
          <ErrorText>{unitsError}</ErrorText>
        </View>
      ) : null}

      <View style={styles.block}>
        <Link href="/privacy" style={styles.link}>Privacy Policy</Link>
        <Link href="/terms" style={styles.link}>Terms of Service</Link>
      </View>

      <View style={styles.block}>
        <ShellButton label="Sign out" onPress={signOut} />
      </View>

      <View style={[styles.block, styles.danger]}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.body}>
          This permanently deletes your Entry, photos and everything linked to your account. It can't be undone.
        </Text>
        {!confirming ? (
          <ShellButton variant="primary" label="Delete my account…" onPress={() => setConfirming(true)} />
        ) : (
          <>
            <FieldLabel>Type DELETE to confirm</FieldLabel>
            <TextField value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" placeholder="DELETE" />
            <View style={{ height: 10 }} />
            <ShellButton
              label="Permanently delete my account"
              onPress={doDelete}
              busy={deleting}
              disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
            />
            {!deleting ? (
              <ShellButton variant="ghost" label="Cancel" onPress={() => { setConfirming(false); setConfirmText(''); }} />
            ) : null}
          </>
        )}
        <ErrorText>{deleteError}</ErrorText>
      </View>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  email: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink, marginTop: 6 },
  block: { marginTop: 20, gap: 8 },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.luvRed, textDecorationLine: 'underline' },
  danger: { padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.luvRed, backgroundColor: colors.cream },
  dangerTitle: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.luvRed },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 4 },
});
