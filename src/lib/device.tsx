// "Max 2 accounts per device": a random device ID kept on this phone/browser,
// registered with the server after every sign-in.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { supabase } from './supabase';

const KEY = 'luvdex.deviceId';

function newId() {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function writeStored(value: string) {
  try {
    if (Platform.OS === 'web') localStorage.setItem(KEY, value);
    else await AsyncStorage.setItem(KEY, value);
  } catch {
    // private browsing: the ID lasts for this visit only
  }
}

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await readStored();
  if (stored && /^[A-Za-z0-9-]{16,64}$/.test(stored)) {
    cached = stored;
    return stored;
  }
  cached = newId();
  await writeStored(cached);
  return cached;
}

export type DeviceCheck = { allowed: boolean; accounts: number; max: number };

export async function registerDevice(): Promise<DeviceCheck> {
  if (!supabase) throw new Error('Not connected');
  const { data, error } = await supabase.rpc('register_device', { device: await getDeviceId() });
  if (error) throw error;
  return data as DeviceCheck;
}

type DeviceState = { status: 'idle' | 'checking' | 'allowed' | 'blocked'; recheck: () => Promise<void> };

const DeviceContext = createContext<DeviceState>({ status: 'idle', recheck: async () => {} });

/** Registers this device after sign-in and tells the app if the account is allowed here. */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [status, setStatus] = useState<DeviceState['status']>('idle');

  const recheck = useCallback(async () => {
    if (!userId) {
      setStatus('idle');
      return;
    }
    setStatus((s) => (s === 'allowed' ? s : 'checking'));
    try {
      const res = await registerDevice();
      setStatus(res.allowed ? 'allowed' : 'blocked');
    } catch {
      // Network hiccup: don't lock people out; the server still enforces the limit.
      setStatus('allowed');
    }
  }, [userId]);

  useEffect(() => {
    recheck();
  }, [recheck]);

  return <DeviceContext.Provider value={{ status, recheck }}>{children}</DeviceContext.Provider>;
}

export const useDevice = () => useContext(DeviceContext);
