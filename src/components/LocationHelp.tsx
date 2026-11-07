// Step-by-step help shown on the Radar when the phone's location is blocked,
// missing, or too vague. The steps match the phone being used (iPhone or Android).
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/lib/theme';

function devicePlatform() {
  const ua = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const iPhone = /iPhone|iPad|iPod/.test(ua) || Platform.OS === 'ios';
  const android = /Android/.test(ua) || Platform.OS === 'android';
  return { iPhone, android, phone: iPhone || android };
}

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <View style={styles.help}>
      <Text style={styles.helpTitle}>{title}</Text>
      {steps.map((s, i) => (
        <Text key={i} style={styles.helpStep}>
          {i + 1}. {s}
        </Text>
      ))}
    </View>
  );
}

/** Fixes for a location that is blocked or switched off. */
export function LocationHelp() {
  const { iPhone } = devicePlatform();
  const steps = iPhone
    ? [
        'Open the Settings app → Privacy & Security → Location Services, and make sure it is ON.',
        'On the same screen, scroll down to "Safari Websites" → choose "While Using the App", and turn on "Precise Location".',
        'Back in Safari, tap the page menu (aA) next to www.luvdex.com → Website Settings → Location → Allow.',
        'Reload this page and tap "Try again". (Using Luvdex from your Home Screen? Steps 1–2 apply to it too.)',
      ]
    : [
        "Turn on your phone's Location (swipe down from the top of the screen → Location).",
        'In Chrome, tap the icon to the left of www.luvdex.com → Permissions → Location → Allow.',
        'Reload this page and tap "Try again".',
      ];
  return <Steps title={iPhone ? 'On iPhone:' : 'On Android:'} steps={steps} />;
}

/**
 * Help for a location that arrives but is too vague for the Radar (over 150 m).
 * A kilometre or more on a phone almost always means "Precise Location" is off,
 * which makes iPhones and Android phones blur the position on purpose.
 */
export function LowAccuracyHelp({ accuracy }: { accuracy?: number }) {
  const { iPhone, phone } = devicePlatform();
  const meters = accuracy ? Math.round(accuracy) : null;
  const blurred = (meters ?? 0) >= 1000; // the "approximate location" setting gives roughly 1–10 km
  const howRough = meters
    ? `Your phone is only sharing your location to within about ${
        meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
      }.`
    : 'Your phone is sharing only a rough location.';

  if (!phone) {
    return (
      <Text style={styles.body}>
        {`${howRough} The Radar needs a phone's GPS (accurate to 150 m or better). Open www.luvdex.com on your phone. ` +
          "Laptops usually can't give a precise location."}
      </Text>
    );
  }

  const precise = iPhone
    ? [
        'Open the Settings app → Privacy & Security → Location Services.',
        'Scroll down to "Safari Websites" and turn ON "Precise Location". (This also covers Luvdex on your Home Screen.)',
        'Come back here and tap "Try again".',
      ]
    : [
        'Open the Settings app → Apps → Chrome → Permissions → Location.',
        'Turn ON "Use precise location".',
        'Also check Settings → Location → Location services → Google Location Accuracy is ON.',
        'Come back here and tap "Try again".',
      ];
  const signal = [
    "Turn on Wi-Fi. You don't need to connect to a network; it just helps the phone find itself.",
    'Step outside or near a window, then wait about 30 seconds.',
    ...precise.slice(0, 2).map((s, i) => (i === 0 ? `Still rough? ${s}` : s)),
  ];

  return (
    <>
      <Text style={styles.body}>
        {howRough} The Radar needs 150 m or better.{' '}
        {blurred
          ? 'That usually means "Precise Location" is switched off, so your phone blurs your position on purpose.'
          : 'This is common indoors.'}
      </Text>
      {blurred ? (
        <Steps title={`Turn on Precise Location (${iPhone ? 'iPhone' : 'Android'}):`} steps={precise} />
      ) : (
        <Steps title="Try this:" steps={signal} />
      )}
      <Text style={styles.body}>This screen updates by itself once your location gets sharper.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  help: { gap: 6, backgroundColor: colors.white, borderRadius: 10, padding: 10 },
  helpTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  helpStep: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
});
