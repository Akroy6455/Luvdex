import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { RadarMap } from '@/components/RadarMap';
import { useAuth } from '@/lib/auth';
import { LOOKING_FOR, labelOf, lookingForColor, updateProfile } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { BAND_LABEL, type NearbyPerson } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';
import { useRadar } from '@/lib/useRadar';

export default function Radar() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading, setProfile } = useProfile();
  const ghost = !!profile?.is_paused;
  const radar = useRadar({ enabled: !!profile?.onboarding_done && !ghost });
  const [ghostBusy, setGhostBusy] = useState(false);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!profileLoading && session && !profile?.onboarding_done) return <Redirect href="/onboarding" />;

  const open = (id: string) => router.push({ pathname: '/entry/[id]', params: { id } });
  const inRange = radar.people.some((p) => p.in_range);

  const leaveGhostMode = async () => {
    if (!session) return;
    setGhostBusy(true);
    try {
      setProfile(await updateProfile(session.user.id, { is_paused: false }));
    } finally {
      setGhostBusy(false);
    }
  };

  return (
    <DeviceFrame
      lensOn={inRange}
      footer={
        <View style={styles.navRow}>
          <NavButton label="My Entry" onPress={() => router.push('/me')} />
          <NavButton label="Scanner" onPress={() => router.push('/scanner')} />
          <NavButton label="Visibility" onPress={() => router.push('/visibility')} />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>RADAR · 500 M</Text>
        {radar.status === 'active' ? (
          <Text style={styles.kicker}>
            {radar.people.length}/5 NEARBY
            {radar.lastUpdated ? ` · ${radar.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
        ) : null}
      </View>

      {radar.status === 'active' || radar.status === 'low_accuracy' ? (
        <RadarMap me={radar.me} people={radar.people} onSelect={open} />
      ) : null}

      <StatusPanel
        status={radar.status}
        accuracy={radar.me?.accuracy}
        onAllow={radar.requestPermission}
        onLeaveGhost={leaveGhostMode}
        ghostBusy={ghostBusy}
      />

      {radar.status === 'active' ? (
        radar.people.length ? (
          <View style={styles.list}>
            {radar.people.map((p) => (
              <PersonCard key={p.user_id} person={p} onPress={() => open(p.user_id)} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one on your Radar right now</Text>
            <Text style={styles.body}>
              Luvdex is new here. Invite friends nearby, try a busier spot, or widen your Scanner settings.
            </Text>
          </View>
        )
      ) : null}
    </DeviceFrame>
  );
}

function StatusPanel({
  status,
  accuracy,
  onAllow,
  onLeaveGhost,
  ghostBusy,
}: {
  status: ReturnType<typeof useRadar>['status'];
  accuracy?: number;
  onAllow: () => void;
  onLeaveGhost: () => void;
  ghostBusy: boolean;
}) {
  switch (status) {
    case 'checking':
    case 'locating':
      return (
        <View style={styles.panel}>
          <ActivityIndicator color={colors.luvRed} />
          <Text style={styles.body}>Finding your location…</Text>
        </View>
      );
    case 'needs_permission':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Turn on location</Text>
          <Text style={styles.body}>
            Luvdex uses your location only while the Radar is open, to show people within 500 m. Others never see your exact
            location, just a rough distance. We keep only your latest position, and delete it after 24 hours.
          </Text>
          <ShellButton label="Turn on location" onPress={onAllow} />
        </View>
      );
    case 'denied':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Location is blocked</Text>
          <Text style={styles.body}>
            To use the Radar, allow location for www.luvdex.com in your browser: tap the icon next to the web address, then
            Permissions → Location → Allow. Then reload this page.
          </Text>
        </View>
      );
    case 'low_accuracy':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your location is too rough</Text>
          <Text style={styles.body}>
            {accuracy ? `It's only accurate to about ${Math.round(accuracy)} m. ` : ''}The Radar needs your phone's GPS. Open
            www.luvdex.com on your phone, ideally outdoors or near a window. Laptops usually can't give a precise location.
          </Text>
        </View>
      );
    case 'ghost':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>👻 Ghost mode is on</Text>
          <Text style={styles.body}>Nobody can see you, and you can't see anyone.</Text>
          <ShellButton label="Turn off Ghost mode" onPress={onLeaveGhost} busy={ghostBusy} />
        </View>
      );
    case 'error':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Couldn't read your location</Text>
          <Text style={styles.body}>Check that location is switched on for your browser, then reload the page.</Text>
        </View>
      );
    default:
      return null;
  }
}

function PersonCard({ person, onPress }: { person: NearbyPerson; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, person.in_range && styles.cardInRange]}>
      {person.photo_url ? (
        <Image source={{ uri: person.photo_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Text style={{ color: colors.white, fontSize: 22 }}>♥</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName}>
          {person.first_name}, {person.age}
        </Text>
        <View style={[styles.badge, { backgroundColor: lookingForColor(person.looking_for) }]}>
          <Text style={styles.badgeText}>{labelOf(LOOKING_FOR, person.looking_for).toUpperCase()}</Text>
        </View>
        <Text style={[styles.band, person.in_range && styles.bandInRange]}>
          {person.in_range ? '♥ In Luvball range' : BAND_LABEL[person.distance_band]}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.nav, pressed && { opacity: 0.8 }]}>
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  panel: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.screenEdge, gap: 10 },
  panelTitle: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  list: { marginTop: 14, gap: 10 },
  empty: { marginTop: 14, gap: 6 },
  emptyTitle: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.screenEdge },
  cardInRange: { borderColor: colors.lensPink, backgroundColor: '#FFF0F5' },
  thumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#EEE' },
  thumbEmpty: { backgroundColor: colors.screenEdge, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: colors.ink },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  badgeText: { fontFamily: fonts.pixelBold, fontSize: 9, color: colors.white, letterSpacing: 1 },
  band: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  bandInRange: { color: colors.luvRed, fontFamily: fonts.bodyHeavy },
  chevron: { fontFamily: fonts.bodyHeavy, fontSize: 26, color: colors.inkSoft },
  navRow: { flexDirection: 'row', gap: 8 },
  nav: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#0B0D14' },
  navText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.white },
});
