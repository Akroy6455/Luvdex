import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { EntryCard } from '@/components/EntryCard';
import { useAuth } from '@/lib/auth';
import { fetchMyPhotos, type Photo } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { colors, fonts } from '@/lib/theme';

/** Phase 1 home: your own Entry. The Radar replaces this as the main screen in Phase 2. */
export default function Home() {
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
      lensOn
      footer={
        <>
          <ShellButton label="Edit my Entry" onPress={() => router.push('/entry-edit')} />
          <ShellButton variant="ghost" label="Account & settings" onPress={() => router.push('/account')} />
        </>
      }
    >
      <Text style={styles.kicker}>MY ENTRY · HOW OTHERS SEE YOU</Text>
      {profile && photos ? (
        <EntryCard profile={profile} photos={photos} />
      ) : (
        <ActivityIndicator color={colors.luvRed} style={{ marginVertical: 40 }} />
      )}
      <View style={styles.next}>
        <Text style={styles.nextLabel}>COMING NEXT</Text>
        <Text style={styles.nextBody}>The Radar: spot people within 500 m and throw Luvballs.</Text>
      </View>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1, marginBottom: 10 },
  next: { marginTop: 20, padding: 12, borderRadius: 10, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.screenEdge },
  nextLabel: { fontFamily: fonts.pixelBold, fontSize: 11, color: colors.luvRed, marginBottom: 4 },
  nextBody: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
