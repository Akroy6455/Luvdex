// Phone apps: a real map (react-native-maps). Google Maps on Android, Apple Maps on iPhone;
// both are free in apps. Falls back to the built-in radar display when the Android
// build has no Maps key yet, or before the first location fix.
import Constants from 'expo-constants';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { lookingForColor } from '@/lib/entry';
import { colors } from '@/lib/theme';

import { RadarScope, type RadarViewProps } from './RadarScope';

const androidMapsReady = Boolean(
  (Constants.expoConfig?.extra as { androidMapsConfigured?: boolean } | undefined)?.androidMapsConfigured,
);

export function RadarMap(props: RadarViewProps) {
  const { me, people, flares = [], onSelect } = props;
  if (!me || (Platform.OS === 'android' && !androidMapsReady)) return <RadarScope {...props} />;
  const center = { latitude: me.lat, longitude: me.lng };

  return (
    <View style={styles.frame}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...center, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        minZoomLevel={flares.length ? 11 : 13}
        maxZoomLevel={19}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        showsCompass={false}
      >
        <Circle center={center} radius={500} strokeColor={colors.luvRed} strokeWidth={2} fillColor="rgba(226,58,78,0.04)" />
        <Circle center={center} radius={50} strokeColor={colors.lensPink} strokeWidth={2} fillColor="rgba(255,122,168,0.2)" />

        <Marker coordinate={center} title="You" anchor={{ x: 0.5, y: 0.5 }} zIndex={1}>
          <View style={styles.me}>
            <Text style={styles.meHeart}>♥</Text>
          </View>
        </Marker>

        {people.map((p) => (
          <Marker
            key={p.user_id}
            coordinate={{ latitude: p.approx_lat, longitude: p.approx_lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={2}
            onPress={() => onSelect(p.user_id)}
          >
            <View
              style={[
                styles.person,
                { borderColor: lookingForColor(p.looking_for), backgroundColor: p.in_range ? colors.lensPink : colors.cream },
              ]}
            >
              <Text style={styles.personHeart}>♥</Text>
            </View>
          </Marker>
        ))}
        {flares.map((f) => (
          <Marker
            key={f.flare_id}
            coordinate={{ latitude: f.approx_lat, longitude: f.approx_lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            onPress={() => onSelect(f.user_id)}
          >
            <View style={styles.flare}>
              <Text style={styles.flareIcon}>🔥</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: colors.white },
  me: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.luvRed,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meHeart: { color: colors.white, fontSize: 12 },
  person: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  flare: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FF7A1A',
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flareIcon: { fontSize: 16 },
  personHeart: { color: colors.ink, fontSize: 15 },
});
