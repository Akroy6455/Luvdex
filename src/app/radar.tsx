import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import { LocationHelp, LowAccuracyHelp } from '@/components/LocationHelp';
import { MatchCelebration } from '@/components/MatchCelebration';
import { PushPrompt } from '@/components/PushPrompt';
import { RadarMap } from '@/components/RadarMap';
import { useAuth } from '@/lib/auth';
import { LOOKING_FOR, labelOf, lookingForColor, updateProfile } from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { BAND_LABEL, clearMyLocation, type NearbyPerson } from '@/lib/radar';
import { colors, fonts } from '@/lib/theme';
import { useNotifications } from '@/lib/useNotifications';
import { useRadar } from '@/lib/useRadar';

export default function Radar() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading, setProfile } = useProfile();
  const ghost = !!profile?.is_paused;
  const radar = useRadar({ enabled: !!profile?.onboarding_done && !ghost });
  const notes = useNotifications(!!profile?.onboarding_done);
  const [ghostBusy, setGhostBusy] = useState(false);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!profileLoading && session && !profile?.onboarding_done) return <Redirect href="/onboarding" />;

  const open = (id: string) => router.push({ pathname: '/entry/[id]', params: { id } });
  const contestNote = notes.items.find((n) => n.type === 'contest' && !n.read_at) ?? null;
  const unreadContests = notes.items.filter((n) => n.type === 'contest' && !n.read_at).length;
  const inRange = radar.people.some((p) => p.in_range);

  /** Pause = Ghost mode: hidden from everyone, location removed from the server straight away. */
  const setPaused = async (paused: boolean) => {
    if (!session) return;
    setGhostBusy(true);
    try {
      const saved = await updateProfile(session.user.id, { is_paused: paused });
      if (paused) await clearMyLocation().catch(() => undefined);
      setProfile(saved);
    } finally {
      setGhostBusy(false);
    }
  };
  const leaveGhostMode = () => setPaused(false);

  return (
    <DeviceFrame
      lensOn={inRange}
      footer={
        <View style={styles.navRow}>
          <NavButton label="Luvballs" badge={notes.unreadLuvballs + unreadContests} onPress={() => router.push('/luvballs')} />
          <NavButton label="Caught" badge={notes.unreadMessages} onPress={() => router.push('/caught')} />
          <NavButton label="My Entry" onPress={() => router.push('/me')} />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>
          RADAR · {radar.status === 'active' ? `${radar.people.length}/5 NEARBY` : '500 M'}
        </Text>
        <View style={styles.headerLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/scanner')}>
            <Text style={styles.headerLink}>Scanner</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/visibility')}>
            <Text style={styles.headerLink}>Visibility</Text>
          </Pressable>
        </View>
      </View>

      {contestNote ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            notes.dismiss([contestNote.id]);
            if (contestNote.payload.contest_id)
              router.push({ pathname: '/contest/[id]', params: { id: contestNote.payload.contest_id } });
          }}
          style={styles.contestBanner}
        >
          <Text style={styles.contestTitle}>{contestNote.payload.title ?? '⚔️ Luvball contest'}</Text>
          {contestNote.payload.body ? <Text style={styles.contestBody}>{contestNote.payload.body}</Text> : null}
          <Text style={styles.contestCta}>Open →</Text>
        </Pressable>
      ) : null}

      <PushPrompt variant="banner" />

      {!ghost ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause discovery"
          onPress={() => setPaused(true)}
          disabled={ghostBusy}
          style={({ pressed }) => [styles.pausePill, (pressed || ghostBusy) && { opacity: 0.7 }]}
        >
          <Text style={styles.pauseText}>{ghostBusy ? 'Pausing…' : '⏸  Pause discovery'}</Text>
          <Text style={styles.pauseHint}>Hide me and stop using my location</Text>
        </Pressable>
      ) : null}

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

      <MatchCelebration
        visible={!!notes.pendingMatch}
        name={notes.pendingMatch?.payload.name ?? 'Someone'}
        onView={() => {
          const m = notes.pendingMatch;
          if (!m) return;
          notes.dismiss([m.id]);
          if (m.payload.user_id) router.push({ pathname: '/entry/[id]', params: { id: m.payload.user_id } });
        }}
        onClose={() => notes.pendingMatch && notes.dismiss([notes.pendingMatch.id])}
      />
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
          <LocationHelp />
          <ShellButton label="I've allowed it: try again" onPress={onAllow} />
        </View>
      );
    case 'unavailable':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your phone isn't sharing a location</Text>
          <Text style={styles.body}>Location Services may be switched off for your phone or your browser.</Text>
          <LocationHelp />
          <ShellButton label="Try again" onPress={onAllow} />
        </View>
      );
    case 'slow':
      return (
        <View style={styles.panel}>
          <ActivityIndicator color={colors.luvRed} />
          <Text style={styles.panelTitle}>Still looking for you…</Text>
          <Text style={styles.body}>
            This can take a while indoors. Step near a window or outside. If it never finishes, location is probably switched
            off:
          </Text>
          <LocationHelp />
          <ShellButton label="Try again" onPress={onAllow} />
        </View>
      );
    case 'low_accuracy':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your location is too rough</Text>
          <LowAccuracyHelp accuracy={accuracy} />
          <ShellButton label="I've changed it: try again" onPress={onAllow} />
        </View>
      );
    case 'fake_gps':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Fake location detected</Text>
          <Text style={styles.body}>
            {'Your phone reports that its location is being faked by an app or a "mock location" setting. ' +
              "Luvdex only works with your real location, so the Radar is off. Turn off the location-faking app " +
              '(on Android: Settings → Developer options → "Select mock location app" → None), then try again.'}
          </Text>
          <ShellButton label="Try again" onPress={onAllow} />
        </View>
      );
    case 'ghost':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>⏸ Discovery paused</Text>
          <Text style={styles.body}>
            You're hidden: nobody can see you and you can't see anyone. Luvdex isn't using your location, and your last
            position has been deleted. Your matches and Luvballs are kept.
          </Text>
          <ShellButton label="▶  Resume discovery" onPress={onLeaveGhost} busy={ghostBusy} />
        </View>
      );
    case 'error':
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Couldn't read your location</Text>
          <LocationHelp />
          <ShellButton label="Try again" onPress={onAllow} />
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
          {person.in_range ? '♥ Luvball ready: tap to throw' : BAND_LABEL[person.distance_band]}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function NavButton({ label, onPress, badge }: { label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.nav, pressed && { opacity: 0.8 }]}>
      <Text style={styles.navText}>{label}</Text>
      {badge ? (
        <View style={styles.navBadge}>
          <Text style={styles.navBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLinks: { flexDirection: 'row', gap: 14 },
  contestBanner: { marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: colors.ink, gap: 4 },
  contestTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.white },
  contestBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.cream },
  contestCta: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.sparkYellow, marginTop: 2 },
  pausePill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    alignSelf: 'stretch',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.screenEdge,
  },
  pauseText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  pauseHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  headerLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.luvRed, textDecorationLine: 'underline' },
  navBadge: { position: 'absolute', top: -6, right: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.lensPink, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navBadgeText: { fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.white },
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
