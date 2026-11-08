// Entry (profile) data: types, choices, unit helpers and Supabase calls.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { forgetPhotoUrl, photoUrls } from './photoUrls';
import { supabase } from './supabase';
import { colors } from './theme';

// ---------------------------------------------------------------- types
export type Gender = 'man' | 'woman';
export type LookingFor = 'life_partner' | 'long_term' | 'long_term_open_short' | 'short_term' | 'prefer_not_to_say';
export type Habit = 'never' | 'socially' | 'often' | 'prefer_not_to_say';
export type Education = 'high_school' | 'diploma' | 'bachelors' | 'masters' | 'doctorate' | 'other';
export type Units = 'metric' | 'imperial';

export type Profile = {
  id: string;
  first_name: string;
  birthdate: string; // YYYY-MM-DD
  gender: Gender;
  interested_in: Gender[];
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
  units: Units;
  onboarding_done: boolean;
  /** Visibility band in metres (multiples of 50). */
  visibility_min_m: number;
  visibility_max_m: number;
  /** Ghost mode. */
  is_paused: boolean;
};

/** Fields a user can edit after onboarding (birthdate and gender are locked). */
export type EditableFields = Omit<Profile, 'id' | 'birthdate' | 'gender' | 'interested_in' | 'onboarding_done'>;

export type Photo = { id: string; storage_path: string; position: number; url: string | null };

// ---------------------------------------------------------------- choices
type Choice<T extends string> = { value: T; label: string; color?: string };

export const LOOKING_FOR: Choice<LookingFor>[] = [
  { value: 'life_partner', label: 'Life partner', color: '#E23A4E' },
  { value: 'long_term', label: 'Long-term', color: '#8E5CF7' },
  { value: 'long_term_open_short', label: 'Long-term, open to short', color: '#3B8BEB' },
  { value: 'short_term', label: 'Short-term', color: '#F28C28' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', color: '#6B7280' },
];

export const GENDERS: Choice<Gender>[] = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
];

export const EDUCATION: Choice<Education>[] = [
  { value: 'high_school', label: 'High school' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'masters', label: "Master's" },
  { value: 'doctorate', label: 'Doctorate' },
  { value: 'other', label: 'Other' },
];

export const HABITS: Choice<Habit>[] = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'often', label: 'Often' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const INTERESTS = [
  'Travel', 'Music', 'Movies', 'Cooking', 'Foodie', 'Fitness', 'Yoga', 'Running', 'Cricket', 'Football',
  'Gaming', 'Anime', 'Reading', 'Writing', 'Art', 'Photography', 'Dancing', 'Singing', 'Fashion', 'Tech',
  'Startups', 'Pets', 'Nature', 'Hiking', 'Beaches', 'Coffee', 'Board games', 'Spirituality', 'Volunteering', 'Comedy',
];

export const LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
  'Urdu', 'Odia', 'Assamese', 'Spanish', 'French', 'German', 'Arabic', 'Mandarin', 'Japanese', 'Other',
];

export const MAX_PHOTOS = 4;
export const BIO_MAX = 200;
export const MAX_INTERESTS = 5;

export const labelOf = <T extends string>(choices: Choice<T>[], value: T | null | undefined) =>
  choices.find((c) => c.value === value)?.label ?? '';
export const lookingForColor = (value: LookingFor) => LOOKING_FOR.find((c) => c.value === value)?.color ?? colors.ink;

// ---------------------------------------------------------------- dates & units
export function ageFrom(birthdate: string, today = new Date()): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

/** Returns YYYY-MM-DD if day/month/year form a real calendar date, else null. */
export function toIsoDate(day: string, month: string, year: string): string | null {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || year.length !== 4) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const cmToFtIn = (cm: number) => {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
};
export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54);
export const kgToLb = (kg: number) => Math.round(kg * 2.20462);
export const lbToKg = (lb: number) => Math.round(lb / 2.20462);

/** Feet and inches with plain ' and " (prime symbols don't render in every font), e.g. 5'9". */
export const formatFeet = (cm: number) => {
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}'${inch}"`;
};
export const formatHeight = (cm: number, units: Units) => (units === 'metric' ? `${cm} cm` : formatFeet(cm));
/** Both units, your preferred one first, e.g. "185 cm (6'1")" or "6'1" (185 cm)". */
export const formatHeightBoth = (cm: number, units: Units) =>
  units === 'metric' ? `${cm} cm (${formatFeet(cm)})` : `${formatFeet(cm)} (${cm} cm)`;
export const formatWeight = (kg: number, units: Units) => (units === 'metric' ? `${kg} kg` : `${kgToLb(kg)} lb`);

export const HEIGHT_RANGE = { min: 120, max: 230 };
export const WEIGHT_RANGE = { min: 30, max: 250 };

/** Your own profile in the same shape used to draw anyone's Entry card. */
export function toEntryView(p: Profile) {
  return {
    first_name: p.first_name,
    age: ageFrom(p.birthdate),
    looking_for: p.looking_for,
    height_cm: p.height_cm,
    weight_kg: p.weight_kg,
    education_level: p.education_level,
    school: p.school,
    job_title: p.job_title,
    company: p.company,
    bio: p.bio,
    interests: p.interests,
    languages: p.languages,
    drinking: p.drinking,
    smoking: p.smoking,
  };
}

// ---------------------------------------------------------------- Supabase calls
function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

type NewProfile = Omit<Profile, 'onboarding_done' | 'visibility_min_m' | 'visibility_max_m' | 'is_paused'>;

export async function upsertProfile(profile: NewProfile & { onboarding_done?: boolean }) {
  const { data, error } = await client().from('profiles').upsert(profile).select('*').single();
  if (error) throw friendlyError(error);
  return data as Profile;
}

export async function updateProfile(userId: string, fields: Partial<EditableFields> & { onboarding_done?: boolean }) {
  const { data, error } = await client().from('profiles').update(fields).eq('id', userId).select('*').single();
  if (error) throw friendlyError(error);
  return data as Profile;
}

export async function fetchMyPhotos(userId: string): Promise<Photo[]> {
  const { data, error } = await client()
    .from('photos')
    .select('id, storage_path, position')
    .eq('user_id', userId)
    .order('position');
  if (error) throw error;
  if (!data.length) return [];
  const urls = await photoUrls(data.map((p) => p.storage_path));
  return data.map((p) => ({ ...p, url: urls[p.storage_path] ?? null }));
}

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * Resizes to max 1280 px on the long side and re-encodes as JPEG. Re-encoding drops
 * hidden EXIF data, including the GPS location many phones embed in photos.
 */
async function prepareImage(uri: string, width?: number, height?: number): Promise<ArrayBuffer> {
  const longest = Math.max(width ?? 0, height ?? 0);
  const ctx = ImageManipulator.manipulate(uri);
  if (longest > 1280) ctx.resize(width! >= height! ? { width: 1280 } : { height: 1280 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const response = await fetch(saved.uri);
  return response.arrayBuffer();
}

export type LocalPhoto = { uri: string; width?: number; height?: number };

export async function uploadPhoto(userId: string, photo: LocalPhoto, position: number) {
  const body = await prepareImage(photo.uri, photo.width, photo.height);
  const path = `${userId}/${randomId()}.jpg`;
  const { error: uploadError } = await client()
    .storage.from('photos')
    // File names are random and never reused, so phones and browsers may cache them for a year.
    .upload(path, body, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
  const { error } = await client().from('photos').insert({ user_id: userId, storage_path: path, position });
  if (error) {
    await client().storage.from('photos').remove([path]);
    throw friendlyError(error);
  }
}

export async function deletePhoto(photo: Pick<Photo, 'id' | 'storage_path'>) {
  const { error } = await client().from('photos').delete().eq('id', photo.id);
  if (error) throw friendlyError(error);
  await client().storage.from('photos').remove([photo.storage_path]);
  forgetPhotoUrl(photo.storage_path);
}

export async function setPhotoOrder(photoIds: string[]) {
  const { error } = await client().rpc('set_photo_order', { photo_ids: photoIds });
  if (error) throw friendlyError(error);
}

export async function deleteMyAccount() {
  const { data, error } = await client().functions.invoke('delete-account', { method: 'POST' });
  if (error || !data?.ok) throw new Error('We could not delete your account. Please try again.');
  await client().auth.signOut({ scope: 'local' });
}

function friendlyError(error: { message: string }) {
  // Messages raised by our database rules are already written for people.
  return new Error(error.message || 'Something went wrong. Please try again.');
}
