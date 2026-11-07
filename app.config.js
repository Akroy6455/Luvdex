// Luvdex app settings (website, Android and iPhone).
// This replaces app.json so build-time keys can come from environment variables:
// locally from .env.local, and for phone builds from Expo's "Environment variables"
// page (expo.dev → project → Environment variables). No secret values live in this file.
const fs = require('fs');

const env = process.env;

// The iPhone Google sign-in ID (Google Cloud → Credentials → iOS client), e.g.
// 1234-abcd.apps.googleusercontent.com. Its reversed form is the app's sign-in URL scheme.
const iosGoogleClientId = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosGoogleUrlScheme = iosGoogleClientId
  ? `com.googleusercontent.apps.${iosGoogleClientId.replace('.apps.googleusercontent.com', '')}`
  : null;

// Firebase file for Android notifications: an Expo "file" environment variable on builds,
// or a local google-services.json (git-ignored).
const googleServicesFile =
  env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

const LOCATION_TEXT =
  'Luvdex uses your location only while the Radar is open, to show people within 500 m. Others see a rough distance, never your exact location.';

module.exports = () => ({
  name: 'Luvdex',
  slug: 'luvdex',
  scheme: 'luvdex',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ...(env.EXPO_OWNER ? { owner: env.EXPO_OWNER } : {}),

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.luvdex',
    usesAppleSignIn: true,
    infoPlist: {
      // Luvdex only uses standard HTTPS encryption (skips the export-compliance question).
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'app.luvdex',
    adaptiveIcon: {
      backgroundColor: '#E23A4E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    // Never ask for "all the time" location or the microphone.
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.RECORD_AUDIO'],
  },

  web: {
    output: 'single',
    favicon: './public/favicon-64.png',
    name: 'Luvdex',
    shortName: 'Luvdex',
    themeColor: '#E23A4E',
    backgroundColor: '#9E1B32',
  },

  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#9E1B32' },
    ],
    ['expo-location', { locationWhenInUsePermission: LOCATION_TEXT }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Luvdex needs your photos so you can add pictures to your Entry.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#E23A4E' }],
    'expo-apple-authentication',
    // Google Maps on Android (iPhone uses Apple Maps, which needs no key).
    ...(env.GOOGLE_MAPS_ANDROID_KEY
      ? [['react-native-maps', { androidGoogleMapsApiKey: env.GOOGLE_MAPS_ANDROID_KEY }]]
      : []),
    // Native Google sign-in. Android needs no build setting; iPhone needs its URL scheme.
    ...(iosGoogleUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: iosGoogleUrlScheme }]] : []),
  ],

  experiments: { typedRoutes: true },

  extra: {
    // Lets the Android app fall back to the built-in radar display if it was built without a Maps key.
    androidMapsConfigured: Boolean(env.GOOGLE_MAPS_ANDROID_KEY),
    eas: env.EAS_PROJECT_ID ? { projectId: env.EAS_PROJECT_ID } : undefined,
  },
});
