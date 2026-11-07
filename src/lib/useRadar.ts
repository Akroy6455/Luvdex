// Watches the phone's location while the Radar is open, sends it to the server
// (at most every ~30 s, or after moving ~25 m), and refreshes who is nearby.
//
// Website: uses the browser's geolocation directly. (expo-location's web version
// ignores browser errors, which left iPhones stuck on "Finding your location…".)
// Phone apps: uses expo-location.
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from './device';
import { getNearby, offsetMeters, sendLocation, type NearbyPerson } from './radar';

export type RadarStatus =
  | 'checking' // looking at permission state
  | 'needs_permission' // show our explanation before the browser/phone asks
  | 'denied' // location blocked for Luvdex (browser or phone settings)
  | 'unavailable' // the phone's Location Services are off / no position source
  | 'locating' // waiting for the first fix
  | 'slow' // still no fix after a while (indoors, weak signal)
  | 'low_accuracy' // location too vague (typical on laptops / indoors)
  | 'ghost' // Ghost mode is on
  | 'active'
  | 'error';

export type MyPosition = { lat: number; lng: number; accuracy: number };

type Fix = { coords: { latitude: number; longitude: number; accuracy: number | null } };

const SEND_EVERY_MS = 30_000;
const SEND_AFTER_MOVING_M = 25;
const REFRESH_EVERY_MS = 20_000;
const MAX_ACCURACY_M = 150;
const SLOW_AFTER_MS = 15_000;

const isWeb = Platform.OS === 'web';

async function webPermissionState(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return res.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'prompt'; // browsers without the Permissions API: just ask
  }
}

export function useRadar({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<RadarStatus>('checking');
  const [me, setMe] = useState<MyPosition | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotFix = useRef(false);

  const refreshNearby = useCallback(async () => {
    try {
      setPeople(await getNearby());
      setLastUpdated(new Date());
    } catch {
      // Keep showing the last list; the next refresh will try again.
    }
  }, []);

  const handlePosition = useCallback(
    async (pos: Fix) => {
      gotFix.current = true;
      const accuracy = pos.coords.accuracy ?? 9999;
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy };
      setMe(next);
      if (accuracy > MAX_ACCURACY_M) {
        setStatus('low_accuracy');
        return;
      }
      setStatus('active');

      const prev = lastSent.current;
      const moved = prev ? Math.hypot(...Object.values(offsetMeters(prev, next))) : Infinity;
      if (prev && Date.now() - prev.at < SEND_EVERY_MS && moved < SEND_AFTER_MOVING_M) return;
      try {
        const result = await sendLocation(next.lat, next.lng, accuracy);
        if (result === 'ok') lastSent.current = { at: Date.now(), lat: next.lat, lng: next.lng };
        if (result === 'low_accuracy') setStatus('low_accuracy');
        // Device registration expired or missing: register again; the next update will go through.
        if (result === 'no_device') await registerDevice().catch(() => undefined);
      } catch {
        return;
      }
      refreshNearby();
    },
    [refreshNearby],
  );

  const stop = useCallback(() => {
    stopWatch.current?.();
    stopWatch.current = null;
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = null;
  }, []);

  /** Starts watching. On the website this also triggers the browser's permission prompt. */
  const startWatching = useCallback(async () => {
    stop();
    gotFix.current = false;
    setStatus('locating');
    slowTimer.current = setTimeout(() => {
      if (!gotFix.current) setStatus((s) => (s === 'locating' ? 'slow' : s));
    }, SLOW_AFTER_MS);

    if (isWeb) {
      if (!('geolocation' in navigator)) {
        setStatus('unavailable');
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (p) => handlePosition(p),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            stop();
            setStatus('denied');
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setStatus((s) => (gotFix.current ? s : 'unavailable'));
          } else {
            // TIMEOUT: the watch keeps trying; tell the user if we have nothing yet.
            setStatus((s) => (gotFix.current ? s : 'slow'));
          }
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
      );
      stopWatch.current = () => navigator.geolocation.clearWatch(id);
      return;
    }

    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 10 },
        (p) => handlePosition(p),
        () => setStatus('error'),
      );
      stopWatch.current = () => sub.remove();
    } catch {
      setStatus('error');
    }
  }, [handlePosition, stop]);

  /** Called from our "Turn on location" / "Try again" buttons (a tap, so iPhones show the prompt). */
  const requestPermission = useCallback(async () => {
    setPermissionAsked(true);
    if (isWeb) {
      startWatching(); // the browser asks for permission here; a refusal arrives as PERMISSION_DENIED
      return;
    }
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.granted) startWatching();
      else setStatus('denied');
    } catch {
      setStatus('denied');
    }
  }, [startWatching]);

  // Start (or stop) when the Radar opens, closes, or Ghost mode changes.
  useEffect(() => {
    if (!enabled) {
      stop();
      setPeople([]);
      setStatus('ghost');
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus('checking');
      if (isWeb) {
        const state = await webPermissionState();
        if (cancelled) return;
        if (state === 'granted') startWatching();
        else if (state === 'denied') setStatus('denied');
        else setStatus('needs_permission');
        return;
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.granted) startWatching();
        else if (perm.canAskAgain === false && perm.status === 'denied') setStatus('denied');
        else setStatus('needs_permission');
      } catch {
        if (!cancelled) setStatus('needs_permission');
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, startWatching, stop]);

  // Refresh the list regularly even when standing still (others move too).
  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(refreshNearby, REFRESH_EVERY_MS);
    return () => clearInterval(t);
  }, [status, refreshNearby]);

  return {
    status,
    me,
    people,
    lastUpdated,
    requestPermission,
    permissionAsked,
    retry: requestPermission,
    refresh: refreshNearby,
  };
}
