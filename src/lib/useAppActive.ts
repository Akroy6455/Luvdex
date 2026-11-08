// Is Luvdex on screen right now? False when the browser tab is hidden or the phone app is
// in the background. Used to pause polling and location tracking, which saves battery,
// data and server usage (a forgotten open tab otherwise keeps calling the server all day).
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

function currentlyActive() {
  if (Platform.OS === 'web') return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  return AppState.currentState === 'active' || AppState.currentState == null;
}

export function useAppActive() {
  const [active, setActive] = useState(currentlyActive);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const onChange = () => setActive(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    }
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return active;
}
