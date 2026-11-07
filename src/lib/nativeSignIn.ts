// Phone apps: Google sign-in with the phone's own account picker, and Sign in with Apple
// on iPhone. Both hand Supabase a signed token from Google/Apple (signInWithIdToken).
// The website uses nativeSignIn.web.ts instead, so none of this is loaded there.
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Thrown when the person closes the Google/Apple sheet. Not an error worth showing. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
  }
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;
function configureGoogle() {
  if (configured) return;
  GoogleSignin.configure({ webClientId, ...(iosClientId ? { iosClientId } : {}) });
  configured = true;
}

export async function nativeGoogleSignIn() {
  if (!supabase) throw new Error('Luvdex is not connected to Supabase yet.');
  if (!webClientId || (Platform.OS === 'ios' && !iosClientId)) {
    throw new Error('Google sign-in is not set up in this version of the app yet.');
  }
  configureGoogle();
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw new SignInCancelled();
    const token = res.data.idToken;
    if (!token) throw new Error("Google didn't return a sign-in token. Please try again.");
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
  } catch (e) {
    if (e instanceof SignInCancelled) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) throw new SignInCancelled();
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services is missing or out of date on this phone.');
      }
    }
    throw e;
  }
}

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function nativeAppleSignIn() {
  if (!supabase) throw new Error('Luvdex is not connected to Supabase yet.');
  // A one-time value Apple signs into the token, so a stolen token can't be replayed.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token. Please try again.");
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
    // Apple shares the name only on the very first sign-in: keep it for the sign-up steps.
    const given = credential.fullName?.givenName;
    if (given) {
      const full = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
      await supabase.auth.updateUser({ data: { given_name: given, full_name: full } }).catch(() => undefined);
    }
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
}

/** Forget the Google account on this phone, so the next sign-in shows the account picker. */
export async function nativeSignOut() {
  try {
    configureGoogle();
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google on this phone
  }
}
