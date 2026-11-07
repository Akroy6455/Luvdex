import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { nativeAppleSignIn, nativeGoogleSignIn, nativeSignOut } from './nativeSignIn';
import { forgetPushForThisDevice } from './push';
import { initialAuthError, supabase } from './supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  /** Set when Google/Supabase sent the user back with a sign-in error. */
  authError: string | null;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true, authError: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authError = initialAuthError;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading, authError }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export { SignInCancelled, appleSignInAvailable } from './nativeSignIn';

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Luvdex is not connected to Supabase yet.');
  if (Platform.OS !== 'web') {
    await nativeGoogleSignIn(); // the phone's own Google account picker
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

/** iPhone app only (Apple requires it next to Google sign-in). */
export async function signInWithApple() {
  await nativeAppleSignIn();
}

export async function signOut() {
  await forgetPushForThisDevice(); // so this device stops getting the old account's alerts
  await supabase?.auth.signOut();
  if (Platform.OS !== 'web') await nativeSignOut();
}
