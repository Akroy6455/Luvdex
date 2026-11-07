// Watches the phone's location while the Radar is open, sends it to the server
// (at most every ~30 s, or after moving ~25 m), and refreshes who is nearby.
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { registerDevice } from './device';
import { getNearby, offsetMeters, sendLocation, type NearbyPerson } from './radar';

export type RadarStatus =
  | 'checking' // looking at permission state
  | 'needs_permission' // show our explanation before the browser/phone asks
  | 'denied' // the user said no
  | 'locating' // waiting for the first GPS fix
  | 'low_accuracy' // location too vague (typical on laptops / indoors)
  | 'ghost' // Ghost mode is on
  | 'active'
  | 'error';

export type MyPosition = { lat: number; lng: number; accuracy: number };

const SEND_EVERY_MS = 30_000;
const SEND_AFTER_MOVING_M = 25;
const REFRESH_EVERY_MS = 20_000;
const MAX_ACCURACY_M = 150;

export function useRadar({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<RadarStatus>('checking');
  const [me, setMe] = useState<MyPosition | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  const refreshNearby = useCallback(async () => {
    try {
      setPeople(await getNearby());
      setLastUpdated(new Date());
    } catch {
      // Keep showing the last list; the next refresh will try again.
    }
  }, []);

  const handlePosition = useCallback(
    async (pos: Location.LocationObject) => {
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

  const startWatching = useCallback(async () => {
    watcher.current?.remove();
    setStatus('locating');
    try {
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 10 },
        handlePosition,
        () => setStatus('error'),
      );
    } catch {
      setStatus('error');
    }
  }, [handlePosition]);

  /** Called from our "Turn on location" button, so the system prompt appears in context. */
  const requestPermission = useCallback(async () => {
    setPermissionAsked(true);
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
      watcher.current?.remove();
      watcher.current = null;
      setPeople([]);
      setStatus('ghost');
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus('checking');
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
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [enabled, startWatching]);

  // Refresh the list regularly even when standing still (others move too).
  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(refreshNearby, REFRESH_EVERY_MS);
    return () => clearInterval(t);
  }, [status, refreshNearby]);

  return { status, me, people, lastUpdated, requestPermission, permissionAsked, refresh: refreshNearby };
}
