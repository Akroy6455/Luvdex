// Website: phone-app sign-in isn't used here (the website signs in through Google's page).
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
  }
}

export async function nativeGoogleSignIn(): Promise<void> {
  throw new Error('Not available on the website.');
}

export async function appleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function nativeAppleSignIn(): Promise<void> {
  throw new Error('Not available on the website.');
}

export async function nativeSignOut(): Promise<void> {}
