import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

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

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Luvdex is not connected to Supabase yet.');
  if (Platform.OS !== 'web') {
    // Native Google sign-in (@react-native-google-signin + signInWithIdToken) arrives with the phone apps.
    throw new Error('Phone-app sign-in is coming later. Please use the website for now.');
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}
