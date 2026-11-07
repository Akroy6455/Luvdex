// Luvball contests: rock-paper-scissors between people who threw at the same person within an hour.
import { supabase } from './supabase';

export type Move = 'rock' | 'paper' | 'scissors';

export type Contest = {
  id: string;
  kind: 'challenge' | 'playoff';
  status: 'pending' | 'playing' | 'finished' | 'cancelled';
  round: number;
  deadline_at: string;
  /** holder = threw first and must accept; challenger = threw later; player = playoff between later throwers */
  role: 'holder' | 'challenger' | 'player';
  target_name: string;
  must_accept: boolean;
  my_move: Move | null;
  rival_moved: boolean;
  last_my_move: Move | null;
  last_rival_move: Move | null;
  result: 'won' | 'lost' | 'cancelled' | null;
  reason: string | null;
  created_at: string;
  finished_at: string | null;
};

export const MOVES: { value: Move; emoji: string; label: string }[] = [
  { value: 'rock', emoji: '✊', label: 'Rock' },
  { value: 'paper', emoji: '✋', label: 'Paper' },
  { value: 'scissors', emoji: '✌️', label: 'Scissors' },
];

export const moveEmoji = (m: Move | null) => MOVES.find((x) => x.value === m)?.emoji ?? '❔';

function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

const friendly = (e: { message?: string }) => new Error(e.message || 'Something went wrong. Please try again.');

export async function getMyContests(): Promise<Contest[]> {
  const { data, error } = await client().rpc('get_my_contests');
  if (error) throw friendly(error);
  return (data ?? []) as Contest[];
}

export async function getContest(id: string): Promise<Contest | null> {
  const { data, error } = await client().rpc('get_contest', { contest: id });
  if (error) throw friendly(error);
  return (data as Contest) ?? null;
}

export async function respondChallenge(id: string, accept: boolean): Promise<Contest> {
  const { data, error } = await client().rpc('respond_challenge', { contest: id, accept });
  if (error) throw friendly(error);
  return data as Contest;
}

export async function submitMove(id: string, move: Move): Promise<Contest> {
  const { data, error } = await client().rpc('submit_move', { contest: id, move });
  if (error) throw friendly(error);
  return data as Contest;
}

/** True if this contest is waiting for *you* to do something. */
export const needsMe = (c: Contest) => c.must_accept || (c.status === 'playing' && !c.my_move);

export function secondsLeft(deadline: string, now = Date.now()) {
  return Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000));
}

export function formatClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
