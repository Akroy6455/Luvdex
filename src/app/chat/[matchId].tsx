import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import {
  MESSAGE_MAX,
  fetchMessages,
  getConversations,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  type Conversation,
  type Message,
} from '@/lib/chat';
import { useAppActive } from '@/lib/useAppActive';
import { colors, fonts } from '@/lib/theme';

const POLL_MS = 30_000; // safety net in case the live connection drops

export default function Chat() {
  const active = useAppActive();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { session, loading } = useAuth();
  const myId = session?.user.id;
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const reload = useCallback(async () => {
    if (!matchId || !myId) return;
    try {
      merge(await fetchMessages(String(matchId)));
      await markConversationRead(String(matchId), myId);
    } catch {
      // keep what we have
    }
  }, [matchId, myId, merge]);

  // Live updates come through the realtime connection; the slow poll is only a safety net,
  // and everything pauses while Luvdex is hidden.
  useEffect(() => {
    if (!matchId || !myId || !active) return;
    getConversations()
      .then((list) => setConv(list.find((c) => c.match_id === matchId) ?? null))
      .catch(() => setConv(null));
    reload();
    const unsubscribe = subscribeToConversation(String(matchId), (m) => {
      merge([m]);
      if (m.sender_id !== myId) markConversationRead(String(matchId), myId);
    });
    const t = setInterval(reload, POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(t);
    };
  }, [matchId, myId, active, reload, merge]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const send = async () => {
    const body = text.trim();
    if (!body || !myId || !matchId || sending) return;
    setSending(true);
    setError(null);
    try {
      merge([await sendMessage(String(matchId), myId, body)]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/caught'));

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          {conv ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${conv.first_name}'s Entry`}
              onPress={() => router.push({ pathname: '/entry/[id]', params: { id: conv.user_id } })}
              style={styles.who}
            >
              {conv.photo_url ? (
                <Image source={{ uri: conv.photo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={{ color: colors.white }}>♥</Text>
                </View>
              )}
              <View>
                <Text style={styles.name}>
                  {conv.first_name}, {conv.age}
                </Text>
                <Text style={styles.sub}>Tap to see their Entry</Text>
              </View>
            </Pressable>
          ) : (
            <Text style={styles.name}>Chat</Text>
          )}
        </View>

        <View style={styles.screen}>
          {conv === undefined ? (
            <ActivityIndicator color={colors.luvRed} style={{ marginTop: 40 }} />
          ) : conv === null ? (
            <View style={styles.ended}>
              <Text style={styles.endedTitle}>This conversation has ended</Text>
              <Text style={styles.tip}>The match was removed by one of you.</Text>
            </View>
          ) : (
            <ScrollView ref={scrollRef} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              <View style={styles.tipBox}>
                <Text style={styles.tipTitle}>💞 You caught each other</Text>
                <Text style={styles.tip}>
                  Stay safe: meet somewhere public, tell a friend where you're going, and never send money. You can block or
                  report from their Entry at any time.
                </Text>
              </View>
              {messages.map((m) => {
                const mine = m.sender_id === myId;
                return (
                  <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.body, mine && styles.bodyMine]}>{m.body}</Text>
                    </View>
                    <Text style={styles.time}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {mine && m.read_at ? ' · Seen' : ''}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {conv ? (
          <View style={styles.inputBar}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={(t) => setText(t.slice(0, MESSAGE_MAX))}
                placeholder={`Message ${conv.first_name}…`}
                placeholderTextColor="#8A90A3"
                style={styles.input}
                multiline
                onSubmitEditing={send}
                blurOnSubmit={false}
                onKeyPress={(e) => {
                  // Enter sends on web; Shift+Enter makes a new line.
                  const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
                  if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                    (e as unknown as { preventDefault: () => void }).preventDefault?.();
                    send();
                  }
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                onPress={send}
                disabled={!text.trim() || sending}
                style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]}
              >
                {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>➤</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.deepShell },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.luvRed },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, lineHeight: 36, color: colors.white, fontFamily: fonts.bodyHeavy },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: colors.white, backgroundColor: '#EEE' },
  avatarEmpty: { backgroundColor: colors.lensPink, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.white },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.cream },
  screen: { flex: 1, backgroundColor: colors.screenMint, marginHorizontal: 8, borderRadius: 16, overflow: 'hidden' },
  list: { padding: 12, gap: 6 },
  tipBox: { backgroundColor: colors.cream, borderRadius: 12, padding: 10, marginBottom: 8, gap: 2 },
  tipTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.luvRed },
  tip: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  row: { maxWidth: '82%', gap: 2 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.luvRed, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  body: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21, color: colors.ink },
  bodyMine: { color: colors.white },
  time: { fontFamily: fonts.body, fontSize: 10, color: colors.inkSoft },
  ended: { padding: 24, gap: 6 },
  endedTitle: { fontFamily: fonts.bodyHeavy, fontSize: 18, color: colors.ink },
  inputBar: { padding: 8, gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 23,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: colors.ink,
  },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontSize: 18 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white, textAlign: 'center' },
});
