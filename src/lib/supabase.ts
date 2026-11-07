import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// These two values are public by design (protected by database security rules).
// Locally they live in .env.local; on Vercel they are set as Environment Variables.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/**
 * On web, a failed Google sign-in comes back as ?error_description=... (or in the #hash).
 * Read it now, before the Supabase client and the router tidy the address bar.
 */
function readRedirectError(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const message = query.get('error_description') ?? hash.get('error_description');
  if (!message) return null;
  console.warn('Sign-in failed:', message);
  window.history.replaceState(null, '', window.location.pathname);
  return "Sign-in didn't finish. Please try again. If it keeps happening, the Google login setup needs checking.";
}

export const initialAuthError = readRedirectError();

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        // Web keeps the session in the browser's localStorage (the default).
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // On web, finish the Google sign-in when Google sends the user back.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

// Phone apps: only refresh the login token while the app is on screen.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
