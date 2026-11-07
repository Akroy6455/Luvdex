// Phone apps: the built-in radar display for now. The native Google Maps version
// (react-native-maps) arrives with the Android/iOS apps in Phase 6.
import { RadarScope, type RadarViewProps } from './RadarScope';

export function RadarMap(props: RadarViewProps) {
  return <RadarScope {...props} />;
}
