import { Redirect } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { signOut, useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/theme';

/** Phase 0 placeholder: proves Google sign-in works end to end. */
export default function Home() {
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/welcome" />;

  const meta = session?.user.user_metadata ?? {};
  const fullName: string = meta.full_name ?? meta.name ?? '';
  const firstName = fullName.split(' ')[0] || 'there';
  const avatar: string | undefined = meta.avatar_url ?? meta.picture;

  return (
    <DeviceFrame lensOn footer={<ShellButton variant="ghost" label="Sign out" onPress={signOut} />}>
      <Text style={styles.entryNo}>SYSTEM · ONLINE</Text>
      <View style={styles.center}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{firstName[0]?.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.title}>Hi, {firstName}!</Text>
        <Text style={styles.body}>You're signed in. Your Luvdex is switched on.</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
      </View>
      <View style={styles.next}>
        <Text style={styles.nextLabel}>NEXT UP</Text>
        <Text style={styles.nextBody}>Creating your Entry: photos, looking for, height & more.</Text>
      </View>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  entryNo: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  center: { alignItems: 'center', marginTop: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.white },
  avatarFallback: { backgroundColor: colors.lensPink, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: fonts.bodyHeavy, fontSize: 40, color: colors.white },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 28, color: colors.ink, marginTop: 14 },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, marginTop: 6, textAlign: 'center' },
  email: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  next: { marginTop: 24, padding: 12, borderRadius: 10, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.screenEdge },
  nextLabel: { fontFamily: fonts.pixelBold, fontSize: 11, color: colors.luvRed, marginBottom: 4 },
  nextBody: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
