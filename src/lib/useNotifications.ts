// Polls unread in-app alerts while a screen is open and Luvdex is on screen.
// (Paused while the tab is hidden or the app is in the background.)
import { useCallback, useEffect, useState } from 'react';

import { getUnreadMessageCount } from './chat';
import { getUnreadNotifications, markRead, type AppNotification } from './luvballs';
import { useAppActive } from './useAppActive';

const POLL_MS = 30_000;

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const active = useAppActive();

  const refresh = useCallback(async () => {
    try {
      const [notes, unread] = await Promise.all([getUnreadNotifications(), getUnreadMessageCount()]);
      setItems(notes);
      setUnreadMessages(unread);
    } catch {
      // try again next poll
    }
  }, []);

  useEffect(() => {
    if (!enabled || !active) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [enabled, active, refresh]);

  const unreadLuvballs = items.filter((n) => n.type === 'luvball_received' && !n.read_at).length;
  const pendingMatch = items.find((n) => n.type === 'match' && !n.read_at) ?? null;

  const dismiss = useCallback(async (ids: string[]) => {
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
    await markRead(ids);
  }, []);

  return { items, unreadLuvballs, unreadMessages, pendingMatch, dismiss, refresh };
}
