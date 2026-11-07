import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

/** Sends people to Welcome (signed out) or Home (signed in). */
export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.deepShell }}>
        <ActivityIndicator color={colors.cream} />
      </View>
    );
  }
  return <Redirect href={session ? '/home' : '/welcome'} />;
}
