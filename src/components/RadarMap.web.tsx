// Website: Google Maps (Maps JavaScript API). Falls back to the built-in radar
// display when no API key is configured.
import { APIProvider, AdvancedMarker, Circle, Map } from '@vis.gl/react-google-maps';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { lookingForColor } from '@/lib/entry';
import { colors } from '@/lib/theme';

import { RadarScope, type RadarViewProps } from './RadarScope';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
// Advanced markers need a Map ID. Google's DEMO_MAP_ID works for testing.
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

export function RadarMap(props: RadarViewProps) {
  const [failed, setFailed] = useState(false);
  if (!API_KEY || failed || !props.me) return <RadarScope {...props} />;
  const { me, people, onSelect } = props;
  const center = { lat: me.lat, lng: me.lng };

  return (
    <View style={styles.frame}>
      <APIProvider apiKey={API_KEY} onError={() => setFailed(true)}>
        <Map
          mapId={MAP_ID}
          defaultCenter={center}
          defaultZoom={15}
          minZoom={13}
          maxZoom={19}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        >
          <Circle
            center={center}
            radius={500}
            strokeColor={colors.luvRed}
            strokeOpacity={0.6}
            strokeWeight={2}
            fillColor={colors.luvRed}
            fillOpacity={0.04}
            clickable={false}
          />
          <Circle
            center={center}
            radius={50}
            strokeColor={colors.lensPink}
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor={colors.lensPink}
            fillOpacity={0.2}
            clickable={false}
          />

          <AdvancedMarker position={center} title="You" zIndex={1}>
            <div style={meStyle}>♥</div>
          </AdvancedMarker>

          {people.map((p) => (
            <AdvancedMarker
              key={p.user_id}
              position={{ lat: p.approx_lat, lng: p.approx_lng }}
              title={`${p.first_name}, ${p.age}`}
              onClick={() => onSelect(p.user_id)}
              zIndex={2}
            >
              <div
                style={{
                  ...personStyle,
                  borderColor: lookingForColor(p.looking_for),
                  background: p.in_range ? colors.lensPink : colors.cream,
                  boxShadow: p.in_range ? `0 0 14px ${colors.lensPink}` : '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                ♥
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}

const meStyle = {
  boxSizing: 'border-box',
  width: 28,
  height: 28,
  borderRadius: 14,
  background: colors.luvRed,
  border: `3px solid ${colors.white}`,
  color: colors.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  boxShadow: '0 0 0 6px rgba(226,58,78,0.25)',
} as const;

const personStyle = {
  boxSizing: 'border-box',
  width: 34,
  height: 34,
  borderRadius: 17,
  borderWidth: 3,
  borderStyle: 'solid',
  color: colors.ink,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  cursor: 'pointer',
} as const;

const styles = StyleSheet.create({
  frame: { width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: colors.white },
});
