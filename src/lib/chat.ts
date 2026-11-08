// Chat between matches: messages, conversation list, live updates.
import type { LookingFor } from './entry';
import { photoUrls } from './photoUrls';
import { supabase } from './supabase';

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type Conversation = {
  match_id: string;
  user_id: string;
  first_name: string;
  age: number;
  looking_for: LookingFor;
  photo_path: string | null;
  photo_url: string | null;
  matched_at: string;
  last_body: string | null;
  last_at: string | null;
  last_from_me: boolean | null;
  unread: number;
};

export const MESSAGE_MAX = 1000;

function client() {
  if (!supabase) throw new Error('Luvdex is not connected to its backend.');
  return supabase;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await client().rpc('get_conversations');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<Conversation, 'photo_url'>[];
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urls = await photoUrls(paths);
  return rows.map((r) => ({ ...r, photo_url: r.photo_path ? urls[r.photo_path] ?? null : null }));
}

export async function getUnreadMessageCount(): Promise<number> {
  const { data, error } = await client().rpc('get_unread_message_count');
  if (error) return 0;
  return (data as number) ?? 0;
}

/** The most recent messages, oldest first. */
export async function fetchMessages(matchId: string, limit = 200): Promise<Message[]> {
  const { data, error } = await client()
    .from('messages')
    .select('id, match_id, sender_id, body, created_at, read_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as Message[]).reverse();
}

export async function sendMessage(matchId: string, senderId: string, body: string): Promise<Message> {
  const { data, error } = await client()
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, body })
    .select('id, match_id, sender_id, body, created_at, read_at')
    .single();
  if (error) {
    if (error.code === '42501') throw new Error("This conversation has ended, so you can't send messages.");
    throw new Error(error.message);
  }
  return data as Message;
}

/** Marks every message from the other person in this conversation as read. */
export async function markConversationRead(matchId: string, myId: string) {
  await client()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', myId)
    .is('read_at', null);
}

/** Live new messages in one conversation. Returns an unsubscribe function. */
export function subscribeToConversation(matchId: string, onMessage: (m: Message) => void) {
  const channel = client()
    .channel(`chat:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    client().removeChannel(channel);
  };
}
