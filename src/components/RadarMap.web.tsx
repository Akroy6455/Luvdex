// Website: Google Maps (Maps JavaScript API). Falls back to the free built-in radar
// display when no API key is configured, or when Google refuses the map (key problem
// or the daily usage cap set in Google Cloud has been reached).
//
// Cost: Google bills each time a map is created. `reuseMaps` keeps the map and reuses it
// whenever the Radar is opened again, so one visit normally costs one map load.
import { APIProvider, AdvancedMarker, Circle, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { lookingForColor } from '@/lib/entry';
import { colors } from '@/lib/theme';

import { RadarScope, type RadarViewProps } from './RadarScope';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
// Advanced markers need a Map ID. Google's DEMO_MAP_ID works for testing.
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

// Remembered for the whole visit, so a refused map isn't retried (and billed) again.
let mapsRefused = false;

/** A reused map keeps its old position: move it to where you are now (once, and when you move far). */
function FollowMe({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const last = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const prev = last.current;
    const movedFar = !prev || Math.abs(prev.lat - lat) > 0.002 || Math.abs(prev.lng - lng) > 0.002;
    if (movedFar) {
      map.panTo({ lat, lng });
      last.current = { lat, lng };
    }
  }, [map, lat, lng]);
  return null;
}

export function RadarMap(props: RadarViewProps) {
  const [failed, setFailed] = useState(mapsRefused);

  // Google calls this when it refuses to show the map (bad key, wrong website, quota).
  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => {
      mapsRefused = true;
      setFailed(true);
    };
  }, []);

  if (!API_KEY || failed || !props.me) return <RadarScope {...props} />;
  const { me, people, flares = [], onSelect } = props;
  const center = { lat: me.lat, lng: me.lng };

  return (
    <View style={styles.frame}>
      <APIProvider
        apiKey={API_KEY}
        onError={() => {
          mapsRefused = true;
          setFailed(true);
        }}
      >
        <Map
          reuseMaps
          mapId={MAP_ID}
          defaultCenter={center}
          defaultZoom={15}
          minZoom={flares.length ? 11 : 13}
          maxZoom={19}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        >
          <FollowMe lat={me.lat} lng={me.lng} />
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
          {flares.map((f) => (
            <AdvancedMarker
              key={f.flare_id}
              position={{ lat: f.approx_lat, lng: f.approx_lng }}
              title={`🔥 ${f.first_name}, ${f.age}`}
              onClick={() => onSelect(f.user_id)}
              zIndex={3}
            >
              <div style={flareStyle}>🔥</div>
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

const flareStyle = {
  boxSizing: 'border-box',
  width: 36,
  height: 36,
  borderRadius: 18,
  background: '#FFF1E6',
  border: '3px solid #FF7A1A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 17,
  cursor: 'pointer',
  boxShadow: '0 0 12px rgba(255,122,26,0.6)',
} as const;

const styles = StyleSheet.create({
  frame: { width: '100%', height: 340, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: colors.white },
});
