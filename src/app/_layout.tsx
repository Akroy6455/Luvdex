import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { Stack } from 'expo-router';

// If any screen crashes, show the error with a "Try again" button instead of a blank white page.
export { ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceGate } from '@/components/DeviceGate';
import { AuthProvider } from '@/lib/auth';
import { DeviceProvider } from '@/lib/device';
import { ProfileProvider } from '@/lib/profile';
import { installWebAppTags, registerServiceWorker } from '@/lib/push';
import { colors } from '@/lib/theme';
import { useNotificationTaps } from '@/lib/useNotificationTaps';

/** Phone apps: open the right screen when a notification is tapped. */
function NotificationTaps() {
  useNotificationTaps();
  return null;
}

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
        <NotificationTaps />
        <DeviceProvider>
          <ProfileProvider>
            <StatusBar style="light" />
            <DeviceGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.deepShell } }} />
            </DeviceGate>
          </ProfileProvider>
        </DeviceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
