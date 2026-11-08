// Phone apps: tapping a notification opens the right screen (chat, contest, Luvballs),
// including when the tap launched the app. Also refreshes this phone's push token.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from './auth';
import { refreshPushToken } from './push';

const ALLOWED = /^\/(luvballs|caught|radar|chat\/[0-9a-f-]{36}|contest\/[0-9a-f-]{36}|entry\/[0-9a-f-]{36})$/;

function open(response: Notifications.NotificationResponse | null | undefined) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && ALLOWED.test(url)) router.push(url as never);
}

export function useNotificationTaps() {
  const { session } = useAuth();
  const signedIn = Boolean(session);

  useEffect(() => {
    if (!signedIn) return;
    refreshPushToken();
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [signedIn]);
}
