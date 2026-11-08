// Admin panel data. Every function here calls a database function that checks admin
// rights on the server, so a non-admin gets "Admins only" no matter what the app does.
import { supabase } from './supabase';

function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message || 'Something went wrong.');
  return data as T;
}

export type DayStat = { day: string; signups: number; throws: number; matches: number; messages: number; flares: number };

export type AdminStats = {
  users_total: number;
  users_incomplete: number;
  new_today: number;
  new_7d: number;
  men: number;
  women: number;
  active_24h: number;
  active_7d: number;
  on_radar_now: number;
  paused: number;
  banned: number;
  throws_today: number;
  throws_7d: number;
  matches_total: number;
  matches_today: number;
  matches_7d: number;
  messages_today: number;
  messages_7d: number;
  flares_today: number;
  flares_7d: number;
  flares_lit_now: number;
  open_reports: number;
  push_devices: number;
  referrals_total: number;
  coins_total: number;
  luvballs_total: number;
  flares_total: number;
  series: DayStat[];
  generated_at: string;
};

export type UserKind = 'real' | 'reviewer' | 'demo';

export type AdminUserRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  gender: 'man' | 'woman' | null;
  age: number | null;
  created_at: string;
  onboarding_done: boolean;
  is_banned: boolean;
  is_paused: boolean;
  luvballs: number | null;
  flares: number | null;
  coins: number | null;
  last_active: string | null;
  open_reports: number;
  kind: UserKind;
  is_admin: boolean;
};

export type UserFilter = 'all' | 'reported' | 'banned' | 'paused' | 'incomplete' | 'admins' | 'review';

export type AdminReport = {
  id: string;
  created_at: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed';
  reporter_id: string;
  reporter_name: string | null;
  reported_id: string;
  reported_name: string | null;
  reported_banned: boolean;
  reporters_30d: number;
};

export type AdminUserDetail = {
  id: string;
  email: string | null;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  kind: UserKind;
  is_admin: boolean;
  age: number | null;
  profile: null | {
    first_name: string;
    gender: string;
    birthdate: string;
    looking_for: string;
    height_cm: number;
    weight_kg: number;
    education_level: string | null;
    school: string | null;
    job_title: string | null;
    company: string | null;
    bio: string | null;
    interests: string[];
    languages: string[];
    drinking: string | null;
    smoking: string | null;
    onboarding_done: boolean;
    is_paused: boolean;
    is_banned: boolean;
    visibility_min_m: number;
    visibility_max_m: number;
    created_at: string;
  };
  wallet: null | { luvballs: number; flares: number; coins: number; next_luvball_at: string; next_flare_at: string };
  location_seen_at: string | null;
  location_accuracy_m: number | null;
  photos: { id: string; storage_path: string; status: 'pending' | 'approved' | 'rejected'; position: number; url?: string | null }[];
  reports_about: {
    id: string;
    reason: string;
    details: string | null;
    status: AdminReport['status'];
    created_at: string;
    reporter_id: string;
    reporter_name: string | null;
  }[];
  counts: Record<
    | 'reports_made'
    | 'matches'
    | 'messages_sent'
    | 'luvballs_out'
    | 'throws_90d'
    | 'flares_fired'
    | 'blocks_made'
    | 'blocked_by'
    | 'devices'
    | 'push'
    | 'referrals',
    number
  >;
  admin_log: { action: string; details: Record<string, unknown>; at: string; admin: string | null }[];
};

export type ActivityItem = {
  id: number;
  at: string;
  action: string;
  details: Record<string, unknown>;
  admin: string | null;
  admin_email: string | null;
  target_id: string | null;
  target_name: string | null;
};

export const isAdmin = () => rpc<boolean>('is_admin');
export const getStats = () => rpc<AdminStats>('admin_stats');
export const listUsers = (q: string, which: UserFilter, lim: number, skip: number) =>
  rpc<{ total: number; rows: AdminUserRow[] }>('admin_list_users', { q, which, lim, skip });
export const setBan = (target: string, banned: boolean, reason: string) =>
  rpc<void>('admin_set_ban', { target, banned, reason });
export const adjustWallet = (target: string, d: { luvballs?: number; flares?: number; coins?: number }, reason: string) =>
  rpc<{ luvballs: number; flares: number; coins: number }>('admin_adjust_wallet', {
    target,
    d_luvballs: d.luvballs ?? 0,
    d_flares: d.flares ?? 0,
    d_coins: d.coins ?? 0,
    reason,
  });
export const setPhotoStatus = (photo: string, status: 'approved' | 'rejected' | 'pending') =>
  rpc<void>('admin_set_photo_status', { photo, new_status: status });
export const listReports = (status: AdminReport['status'] | 'all') =>
  rpc<AdminReport[]>('admin_list_reports', { only_status: status, lim: 200 });
export const setReportStatus = (report: string, status: AdminReport['status']) =>
  rpc<void>('admin_set_report_status', { report, new_status: status });
export const getSettings = () => rpc<Record<string, string>>('admin_get_settings');
export const setSetting = (setting: string, value: number) => rpc<void>('admin_set_setting', { setting, new_value: value });
export const listBlockedTerms = () => rpc<{ term: string; category: string }[]>('admin_list_blocked_terms');
export const addBlockedTerm = (term: string, category: string) =>
  rpc<void>('admin_add_blocked_term', { new_term: term, new_category: category });
export const removeBlockedTerm = (term: string) => rpc<void>('admin_remove_blocked_term', { old_term: term });
export const resetReviewWorld = () => rpc<string>('admin_reset_review_world');
export const getActivity = (lim = 200) => rpc<ActivityItem[]>('admin_activity', { lim });

export async function getUser(id: string): Promise<AdminUserDetail | null> {
  const user = await rpc<AdminUserDetail | null>('admin_get_user', { target: id });
  if (!user) return null;
  const paths = user.photos.map((p) => p.storage_path);
  if (paths.length) {
    const { data } = await client().storage.from('photos').createSignedUrls(paths, 60 * 30);
    const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    user.photos = user.photos.map((p) => ({ ...p, url: map.get(p.storage_path) ?? null }));
  }
  return user;
}

/** "3 min ago", "5 h ago", "12 Nov" */
export function ago(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' });
}

export const REPORT_REASON_LABEL: Record<string, string> = {
  fake_profile: 'Fake profile',
  harassment: 'Harassment',
  inappropriate_photos: 'Inappropriate photos',
  underage: 'Seems under 18',
  safety_concern: 'Safety concern',
  spam: 'Spam or scam',
  other: 'Something else',
};

/** Plain-English summary of an admin log entry. */
export function describe(action: string, d: Record<string, unknown>) {
  const reason = d.reason ? ` (“${String(d.reason)}”)` : '';
  if (action === 'adjust_wallet') {
    const parts = (['luvballs', 'flares', 'coins'] as const)
      .filter((k) => Number(d[k]))
      .map((k) => `${Number(d[k]) > 0 ? '+' : ''}${d[k]} ${k}`);
    return `balance ${parts.join(', ') || 'unchanged'}${reason}`;
  }
  if (action === 'ban' || action === 'unban') return `${action}${reason}`;
  if (action === 'setting') return `setting ${d.key}: ${d.from ?? '—'} → ${d.to}`;
  if (action.startsWith('photo_')) return `photo ${action.slice(6)}`;
  if (action.startsWith('report_')) return `report marked ${action.slice(7)}`;
  if (action === 'blocked_word_add') return `blocked word added: ${d.term}`;
  if (action === 'blocked_word_remove') return `blocked word removed: ${d.term}`;
  if (action === 'reset_review_world') return 'review accounts reset';
  return action;
}
