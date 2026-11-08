import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lookingForColor } from '@/lib/entry';
import { offsetMeters, type FlareSpot, type NearbyPerson } from '@/lib/radar';
import type { MyPosition } from '@/lib/useRadar';
import { colors, fonts } from '@/lib/theme';

export type RadarViewProps = {
  me: MyPosition | null;
  people: NearbyPerson[];
  /** Flares that reached you (can be up to 5 km away). */
  flares?: FlareSpot[];
  onSelect: (userId: string) => void;
};

const RINGS = [500, 250, 100, 50];

/** A built-in radar display (no map). Positions are the same rounded ones the server sends. */
export function RadarScope({ me, people, onSelect }: RadarViewProps) {
  const [size, setSize] = useState(300);
  const r = size / 2;

  return (
    <View style={styles.wrap} onLayout={(e) => setSize(Math.min(e.nativeEvent.layout.width, 360))}>
      <View style={[styles.scope, { width: size, height: size, borderRadius: r }]}>
        {RINGS.map((m) => {
          const rr = (m / 500) * r;
          return (
            <View
              key={m}
              style={[
                styles.ring,
                m === 50 && styles.ring50,
                { width: rr * 2, height: rr * 2, borderRadius: rr, left: r - rr, top: r - rr },
              ]}
            />
          );
        })}
        <Text style={[styles.ringLabel, { top: 6, left: r + 4 }]}>500 m</Text>
        <Text style={[styles.ringLabel, { top: r - (50 / 500) * r - 14, left: r + 4 }]}>50 m</Text>
        <View style={[styles.crossH, { top: r, width: size }]} />
        <View style={[styles.crossV, { left: r, height: size }]} />

        {/* You, drawn first so people very close to you stay tappable on top. */}
        <View style={[styles.me, { left: r - 14, top: r - 14 }]}>
          <Text style={styles.meHeart}>♥</Text>
        </View>

        {me
          ? people.map((p) => {
              const off = offsetMeters(me, { lat: p.approx_lat, lng: p.approx_lng });
              const dist = Math.hypot(off.x, off.y);
              const k = dist > 440 ? 440 / dist : 1; // keep dots fully inside the scope
              const x = r + (off.x * k * r) / 500;
              const y = r - (off.y * k * r) / 500;
              return (
                <Pressable
                  key={p.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.first_name}, ${p.age}`}
                  onPress={() => onSelect(p.user_id)}
                  style={[
                    styles.dot,
                    { left: x - 16, top: y - 16, borderColor: lookingForColor(p.looking_for) },
                    p.in_range && styles.dotInRange,
                  ]}
                >
                  <Text style={styles.dotHeart}>♥</Text>
                </Pressable>
              );
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  scope: { backgroundColor: '#0F3B2E', overflow: 'hidden', borderWidth: 3, borderColor: colors.white },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(216,243,227,0.35)' },
  ring50: { borderWidth: 2, borderColor: colors.lensPink, backgroundColor: 'rgba(255,122,168,0.12)' },
  ringLabel: { position: 'absolute', fontFamily: fonts.pixel, fontSize: 9, color: 'rgba(216,243,227,0.8)' },
  crossH: { position: 'absolute', left: 0, height: 1, backgroundColor: 'rgba(216,243,227,0.15)' },
  crossV: { position: 'absolute', top: 0, width: 1, backgroundColor: 'rgba(216,243,227,0.15)' },
  dot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInRange: { backgroundColor: colors.lensPink, shadowColor: colors.lensPink, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  dotHeart: { fontSize: 14, lineHeight: 18, color: colors.ink },
  me: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.luvRed, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  meHeart: { fontSize: 12, lineHeight: 16, color: colors.white },
});
