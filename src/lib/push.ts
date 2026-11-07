// Phone-app notifications (Android and iPhone) through Expo's push service.
// The website uses push.web.ts (Web Push) instead; both offer the same functions.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type PushState =
  | 'unsupported' // simulator, or the build isn't set up for notifications
  | 'needs_install' // (website only: iPhone must add to Home Screen)
  | 'default' // not turned on yet
  | 'denied' // blocked in the phone's Settings
  | 'subscribed'; // on

const TOKEN_KEY = 'luvdex.pushToken';

// Show notifications as banners even while Luvdex is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Luvballs, matches and messages',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#E23A4E',
  });
}

export async function registerServiceWorker() {
  return null; // website only
}

export function installWebAppTags() {
  // website only
}

export async function getPushState(): Promise<PushState> {
  if (!Device.isDevice || !projectId()) return 'unsupported';
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted) return (await AsyncStorage.getItem(TOKEN_KEY)) ? 'subscribed' : 'default';
  if (perm.status === 'denied' && !perm.canAskAgain) return 'denied';
  return 'default';
}

async function saveToken(): Promise<boolean> {
  if (!supabase) return false;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const { error } = await supabase.rpc('register_push_token', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) return false;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return true;
}

/** Asks permission (from a tap) and registers this phone for the signed-in account. */
export async function enablePush(_userId: string): Promise<PushState> {
  if (!supabase || !Device.isDevice || !projectId()) return 'unsupported';
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  const perm = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? 'default' : 'denied';
  if (!(await saveToken())) throw new Error('Could not save this phone for notifications. Please try again.');
  return 'subscribed';
}

/** Stops notifications to this phone for this account. */
export async function disablePush(): Promise<PushState> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token && supabase) await supabase.rpc('unregister_push_token', { token });
  await AsyncStorage.removeItem(TOKEN_KEY);
  return getPushState();
}

/** On app start (signed in): refresh the token if notifications are on. Tokens can change. */
export async function refreshPushToken() {
  try {
    if (!(await AsyncStorage.getItem(TOKEN_KEY))) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await ensureAndroidChannel();
    await saveToken();
  } catch {
    // offline: try again next launch
  }
}

/** Before signing out: stop this phone receiving the old account's notifications. */
export async function forgetPushForThisDevice() {
  try {
    await disablePush();
  } catch {
    // offline: the server drops dead tokens on its own
  }
}
