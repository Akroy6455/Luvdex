import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { EntryCard } from '@/components/EntryCard';
import { useAuth } from '@/lib/auth';
import { fetchMyPhotos, toEntryView, type Photo } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { colors, fonts } from '@/lib/theme';

/** Your own Entry, as others see it. */
export default function Me() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [photos, setPhotos] = useState<Photo[] | null>(null);

  const userId = session?.user.id;
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchMyPhotos(userId)
        .then(setPhotos)
        .catch(() => setPhotos([]));
    }, [userId]),
  );

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!profileLoading && session && !profile?.onboarding_done) return <Redirect href="/onboarding" />;

  return (
    <DeviceFrame
      footer={
        <>
          <ShellButton label="Edit my Entry" onPress={() => router.push('/entry-edit')} />
          <ShellButton variant="ghost" label="Account & settings" onPress={() => router.push('/account')} />
          <ShellButton variant="ghost" label="← Back to Radar" onPress={() => router.replace('/radar')} />
        </>
      }
    >
      <Text style={styles.kicker}>MY ENTRY · HOW OTHERS SEE YOU</Text>
      {profile && photos ? (
        <EntryCard profile={toEntryView(profile)} photos={photos} units={profile.units} />
      ) : (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 40 }} />
      )}
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 10 },
});
