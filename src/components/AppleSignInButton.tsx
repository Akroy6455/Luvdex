// iPhone app: Apple's official "Sign in with Apple" button (Apple requires its own design).
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { appleSignInAvailable } from '@/lib/auth';

export function AppleSignInButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    appleSignInAvailable().then(setAvailable);
  }, []);
  if (!available) return null;
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled && styles.disabled}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={26}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', height: 52 },
  disabled: { opacity: 0.5 },
});
