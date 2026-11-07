import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import { colors, fonts } from '@/lib/theme';

const DISMISS_KEY = 'luvdex.pushBannerDismissed';

function readDismissed() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Notification switch.
 * - variant "banner": a small dismissible prompt for the Radar (only when there's something to do)
 * - variant "full": the settings row for the Account screen
 */
export function PushPrompt({ variant }: { variant: 'banner' | 'full' }) {
  const { session } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (!state || !session) return null;
  if (variant === 'banner' && (dismissed || !['default', 'needs_install'].includes(state))) return null;
  if (variant === 'banner' && state === 'unsupported') return null;

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      setState(await enablePush(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn on notifications.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      setState(await disablePush());
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private mode: just hide for this visit
    }
  };

  let title = '';
  let text = '';
  let action: { label: string; onPress: () => void } | null = null;
  switch (state) {
    case 'default':
      title = '🔔 Get notified';
      text = 'Know right away when someone throws a Luvball, you match, or get a message, even with Luvdex closed.';
      action = { label: busy ? 'Turning on…' : 'Turn on notifications', onPress: turnOn };
      break;
    case 'needs_install':
      title = '🔔 Notifications on iPhone';
      text = 'Tap the Share button, then "Add to Home Screen". Open Luvdex from your Home Screen and turn notifications on there.';
      break;
    case 'denied':
      title = '🔕 Notifications are blocked';
      text = 'Allow notifications for www.luvdex.com in your browser settings, then come back here.';
      break;
    case 'subscribed':
      title = '✓ Notifications are on for this device';
      text = 'Luvball alerts stay anonymous, and message alerts never show what was said.';
      action = { label: busy ? 'Turning off…' : 'Turn off', onPress: turnOff };
      break;
    case 'unsupported':
      title = 'Notifications not available here';
      text = "This browser doesn't support web notifications. Try Chrome on Android, or Safari on iPhone after adding Luvdex to your Home Screen.";
      break;
  }

  return (
    <View style={[styles.box, variant === 'banner' && styles.banner]}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {variant === 'banner' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={dismiss} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.text}>{text}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          disabled={busy}
          style={[styles.button, state === 'subscribed' && styles.buttonQuiet]}
        >
          <Text style={[styles.buttonText, state === 'subscribed' && styles.buttonTextQuiet]}>{action.label}</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.screenEdge },
  banner: { marginBottom: 10, borderColor: colors.sparkYellow, backgroundColor: '#FFFBEA' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink, flexShrink: 1 },
  close: { fontSize: 14, color: colors.inkSoft, paddingHorizontal: 4 },
  text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  button: { alignSelf: 'flex-start', marginTop: 2, backgroundColor: colors.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  buttonQuiet: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.screenEdge },
  buttonText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.white },
  buttonTextQuiet: { color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.luvRed },
});
