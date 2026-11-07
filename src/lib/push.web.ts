// Website notifications (Web Push). The phone apps use push.ts (Expo push).
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type PushState =
  | 'unsupported' // this browser can't do web push
  | 'needs_install' // iPhone/iPad: must add Luvdex to the Home Screen first
  | 'default' // not asked yet
  | 'denied' // blocked in browser settings
  | 'subscribed'; // on

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function isIos() {
  return isWeb && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (!isWeb) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function supportsPush() {
  return isWeb && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!isWeb || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!isWeb) return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs_install';
  if (!supportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'default';
}

function base64UrlToBytes(b64: string) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks permission (must be called from a tap) and saves this device. */
export async function enablePush(userId: string): Promise<PushState> {
  if (!supabase || !supportsPush()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  const { data: key, error } = await supabase.rpc('get_vapid_public_key');
  if (error || !key) throw new Error('Notifications are not set up on the server yet.');

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key as string) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };

  const { error: saveError } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (saveError) throw new Error('Could not save this device. Please try again.');
  return 'subscribed';
}

export async function disablePush(): Promise<PushState> {
  if (!supabase || !supportsPush()) return getPushState();
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return getPushState();
}

/** Adds the web-app manifest and icons so phones can "Add to Home Screen". */
export function installWebAppTags() {
  if (!isWeb || document.querySelector('link[rel="manifest"]')) return;
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  };
  add('link', { rel: 'manifest', href: '/manifest.json' });
  add('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
  add('meta', { name: 'theme-color', content: '#E23A4E' });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Luvdex' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
}

/** Phone apps only (tokens can change); the browser keeps its subscription itself. */
export async function refreshPushToken() {}

/** Before signing out: stop this browser receiving the old account's notifications. */
export async function forgetPushForThisDevice() {
  try {
    await disablePush();
  } catch {
    // offline or unsupported
  }
}
