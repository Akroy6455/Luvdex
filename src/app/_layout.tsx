import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { ProfileProvider } from '@/lib/profile';
import { installWebAppTags, registerServiceWorker } from '@/lib/push';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Silkscreen_400Regular,
    Silkscreen_700Bold,
  });

  // Website: "Add to Home Screen" support and the notifications service worker.
  useEffect(() => {
    installWebAppTags();
    registerServiceWorker();
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.deepShell }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.deepShell } }} />
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
