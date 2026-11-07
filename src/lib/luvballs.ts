// Luvballs, matches, in-app notifications, blocking and reporting.
import type { LookingFor } from './entry';
import { supabase } from './supabase';

export type ThrowResult =
  | { result: 'thrown'; remaining: number }
  | { result: 'match'; match_id: string; user_id: string; name: string };

export type AppNotification = {
  id: string;
  type: 'luvball_received' | 'match';
  payload: { match_id?: string; user_id?: string; name?: string };
  deliver_at: string;
  read_at: string | null;
};

export type Match = {
  match_id: string;
  user_id: string;
  first_name: string;
  age: number;
  looking_for: LookingFor;
  photo_path: string | null;
  photo_url: string | null;
  matched_at: string;
};

export type ReportReason =
  | 'fake_profile'
  | 'harassment'
  | 'inappropriate_photos'
  | 'underage'
  | 'safety_concern'
  | 'spam'
  | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_photos', label: 'Inappropriate photos' },
  { value: 'underage', label: 'Seems under 18' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Something else' },
];

function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

const friendly = (e: { message?: string } | null) => new Error(e?.message || 'Something went wrong. Please try again.');

export async function throwLuvball(target: string): Promise<ThrowResult> {
  const { data, error } = await client().rpc('throw_luvball', { target });
  if (error) throw friendly(error);
  return data as ThrowResult;
}

export async function getLuvballStatus(): Promise<{ remaining: number; received_active: number }> {
  const { data, error } = await client().rpc('get_luvball_status');
  if (error) throw friendly(error);
  return data as { remaining: number; received_active: number };
}

/** Delivered notifications from the last 30 days (undelivered ones are hidden by the database). */
export async function getNotifications(): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await client()
    .from('notifications')
    .select('id, type, payload, deliver_at, read_at')
    .gte('deliver_at', since)
    .order('deliver_at', { ascending: false })
    .limit(100);
  if (error) throw friendly(error);
  return data as AppNotification[];
}

export async function markRead(ids: string[]) {
  if (!ids.length) return;
  await client().from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
}

export async function getMatches(): Promise<Match[]> {
  const { data, error } = await client().rpc('get_matches');
  if (error) throw friendly(error);
  const rows = (data ?? []) as Omit<Match, 'photo_url'>[];
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await client().storage.from('photos').createSignedUrls(paths, 60 * 30);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  return rows.map((r) => ({ ...r, photo_url: r.photo_path ? urls[r.photo_path] ?? null : null }));
}

export async function unmatch(matchId: string) {
  const { error } = await client().rpc('unmatch', { match: matchId });
  if (error) throw friendly(error);
}

export async function blockUser(target: string) {
  const { error } = await client().rpc('block_user', { target });
  if (error) throw friendly(error);
}

export async function unblockUser(target: string) {
  const { error } = await client().rpc('unblock_user', { target });
  if (error) throw friendly(error);
}

export async function getBlocked(): Promise<{ user_id: string; first_name: string; blocked_at: string }[]> {
  const { data, error } = await client().rpc('get_blocked');
  if (error) throw friendly(error);
  return data ?? [];
}

export async function reportUser(target: string, reason: ReportReason, details: string) {
  const { error } = await client().rpc('report_user', { target, reason, details: details.trim() || null });
  if (error) throw friendly(error);
}

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
