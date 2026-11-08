// Radar data: talking to update_location / get_nearby / get_entry and the filter tables.
import type { Education, Habit, LookingFor } from './entry';
import { supabase } from './supabase';

export type DistanceBand = 'within_50' | '50_100' | '100_250' | '250_500';

export const BAND_LABEL: Record<DistanceBand, string> = {
  within_50: 'Within 50 m',
  '50_100': '50–100 m away',
  '100_250': '100–250 m away',
  '250_500': '250–500 m away',
};

export type NearbyPerson = {
  user_id: string;
  first_name: string;
  age: number;
  looking_for: LookingFor;
  distance_band: DistanceBand;
  in_range: boolean;
  approx_lat: number;
  approx_lng: number;
  photo_path: string | null;
  photo_url: string | null;
};

/** What the app needs to draw an Entry card, for yourself or someone else. */
export type EntryView = {
  first_name: string;
  age: number;
  looking_for: LookingFor;
  height_cm: number;
  weight_kg: number;
  education_level: Education | null;
  school: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  interests: string[];
  languages: string[];
  drinking: Habit | null;
  smoking: Habit | null;
};

/** Someone nearby who lit a Flare that reached you. */
export type FlareSpot = {
  flare_id: string;
  user_id: string;
  first_name: string;
  age: number;
  looking_for: LookingFor;
  photo_path: string | null;
  photo_url: string | null;
  approx_lat: number;
  approx_lng: number;
  distance_m: number;
  expires_at: string;
};

/** "Less than 100 m away", "About 350 m away", "About 1.8 km away". */
export function distanceAway(m: number) {
  if (m < 100) return 'Less than 100 m away';
  if (m < 1000) return `About ${Math.round(m / 10) * 10} m away`;
  return `About ${(m / 1000).toFixed(1)} km away`;
}

/** "45 min left" */
export function minutesLeft(iso: string) {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min left` : `${mins} min left`;
}

export type OtherEntry = EntryView & {
  id: string;
  distance_band: DistanceBand | null;
  in_range: boolean;
  /** Was within 50 m in the last 10 minutes (grace window), but isn't now. */
  grace: boolean;
  /** Your own GPS is precise enough (≤ 75 m) to throw. */
  gps_ok: boolean;
  thrown_by_me: boolean;
  match_id: string | null;
  /** Set while this person's Flare (which reached you) is lit. */
  flare: { distance_m: number; expires_at: string } | null;
  photos: { id: string; storage_path: string; position: number; url: string | null }[];
};

export type Preferences = {
  age_min: number;
  age_max: number;
  height_min: number;
  height_max: number;
  weight_min: number;
  weight_max: number;
  looking_for_filter: LookingFor[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  age_min: 18,
  age_max: 99,
  height_min: 120,
  height_max: 230,
  weight_min: 30,
  weight_max: 250,
  looking_for_filter: ['life_partner', 'long_term', 'long_term_open_short', 'short_term', 'prefer_not_to_say'],
};

export type LocationResult = 'ok' | 'throttled' | 'low_accuracy' | 'jump' | 'no_entry' | 'no_device';

function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await client().storage.from('photos').createSignedUrls(paths, 60 * 30);
  const map: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  return map;
}

export async function sendLocation(lat: number, lng: number, accuracy: number): Promise<LocationResult> {
  const { data, error } = await client().rpc('update_location', { lat, lng, accuracy });
  if (error) throw error;
  return data as LocationResult;
}

export async function clearMyLocation() {
  const { error } = await client().rpc('clear_my_location');
  if (error) throw error;
}

export async function getNearby(): Promise<NearbyPerson[]> {
  const { data, error } = await client().rpc('get_nearby');
  if (error) throw error;
  const rows = (data ?? []) as Omit<NearbyPerson, 'photo_url'>[];
  const urls = await signedUrls(rows.map((r) => r.photo_path).filter((p): p is string => !!p));
  return rows.map((r) => ({ ...r, photo_url: r.photo_path ? urls[r.photo_path] ?? null : null }));
}

export async function getFlares(): Promise<FlareSpot[]> {
  const { data, error } = await client().rpc('get_flares');
  if (error) throw error;
  const rows = (data ?? []) as Omit<FlareSpot, 'photo_url'>[];
  const urls = await signedUrls(rows.map((r) => r.photo_path).filter((p): p is string => !!p));
  return rows.map((r) => ({ ...r, photo_url: r.photo_path ? urls[r.photo_path] ?? null : null }));
}

export async function getEntry(userId: string): Promise<OtherEntry | null> {
  const { data, error } = await client().rpc('get_entry', { target: userId });
  if (error) throw error;
  if (!data) return null;
  const entry = data as OtherEntry;
  const urls = await signedUrls(entry.photos.map((p) => p.storage_path));
  return { ...entry, photos: entry.photos.map((p) => ({ ...p, url: urls[p.storage_path] ?? null })) };
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const { data, error } = await client()
    .from('preferences')
    .select('age_min, age_max, height_min, height_max, weight_min, weight_max, looking_for_filter')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Preferences | null) ?? DEFAULT_PREFERENCES;
}

export async function savePreferences(userId: string, prefs: Preferences) {
  const { error } = await client()
    .from('preferences')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Straight-line offset in metres from `from` to `to` (fine for distances under a few km). */
export function offsetMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  return { x: dLng * R * Math.cos((from.lat * Math.PI) / 180), y: dLat * R };
}
