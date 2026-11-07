import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { colors } from '@/lib/theme';

/** Signed out → Welcome. Signed in without a finished Entry → sign-up steps. Otherwise → Home. */
export default function Index() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (loading || (session && profileLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deepShell }}>
        <ActivityIndicator color={colors.cream} />
      </View>
    );
  }
  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href={profile?.onboarding_done ? '/radar' : '/onboarding'} />;
}
