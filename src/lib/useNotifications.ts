// Polls in-app notifications while a screen is open. (Phone push arrives in Phase 4.)
import { useCallback, useEffect, useState } from 'react';

import { getUnreadMessageCount } from './chat';
import { getNotifications, markRead, type AppNotification } from './luvballs';

const POLL_MS = 20_000;

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [notes, unread] = await Promise.all([getNotifications(), getUnreadMessageCount()]);
      setItems(notes);
      setUnreadMessages(unread);
    } catch {
      // try again next poll
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  const unreadLuvballs = items.filter((n) => n.type === 'luvball_received' && !n.read_at).length;
  const pendingMatch = items.find((n) => n.type === 'match' && !n.read_at) ?? null;

  const dismiss = useCallback(async (ids: string[]) => {
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
    await markRead(ids);
  }, []);

  return { items, unreadLuvballs, unreadMessages, pendingMatch, dismiss, refresh };
}
