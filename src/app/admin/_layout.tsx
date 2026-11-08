// Admin panel frame: checks you're an admin (on the server), then shows the top navigation.
import { Link, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { A, Loading, s } from '@/components/admin/ui';
import { isAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { fonts } from '@/lib/theme';

const TABS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/activity', label: 'Activity log' },
] as const;

export default function AdminLayout() {
  const { session, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const path = usePathname();

  useEffect(() => {
    if (!session) return;
    isAdmin()
      .then(setAllowed)
      .catch(() => setAllowed(false));
  }, [session]);

  if (loading || (session && allowed === null)) {
    return (
      <View style={styles.page}>
        <Loading />
      </View>
    );
  }

  if (!session || !allowed) {
    return (
      <View style={[styles.page, styles.center]}>
        <View style={styles.gate}>
          <Text style={s.h1}>Luvdex admin</Text>
          <Text style={s.muted}>
            {session
              ? 'This account is not an admin. Sign in with an admin Google account.'
              : 'Sign in with your admin Google account first, then come back to this page.'}
          </Text>
          <Link href="/welcome" style={styles.link}>
            {session ? '← Back to Luvdex' : 'Sign in →'}
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <View style={styles.inner}>
          <Text style={styles.brand}>LUVDEX · ADMIN</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => {
              const active = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href) || (t.href === '/admin/users' && path.startsWith('/admin/user/'));
              return (
                <Link key={t.href} href={t.href} asChild>
                  <Pressable style={[styles.tab, active && styles.tabOn]}>
                    <Text style={[styles.tabText, active && styles.tabTextOn]}>{t.label}</Text>
                  </Pressable>
                </Link>
              );
            })}
            <Link href="/radar" asChild>
              <Pressable style={styles.tab}>
                <Text style={styles.tabText}>Open app ↗</Text>
              </Pressable>
            </Link>
          </ScrollView>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.inner}>
          <Slot />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: A.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  gate: { backgroundColor: A.card, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 20, gap: 10, maxWidth: 420 },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: A.red },
  topbar: { backgroundColor: A.ink, paddingHorizontal: 16, paddingTop: 10 },
  inner: { width: '100%', maxWidth: 1200, alignSelf: 'center' },
  brand: { fontFamily: fonts.pixelBold, fontSize: 13, color: '#fff', letterSpacing: 1, marginBottom: 6 },
  tabs: { gap: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 9, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  tabOn: { backgroundColor: A.bg },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#C9CCD6' },
  tabTextOn: { color: A.ink },
  body: { padding: 16, paddingBottom: 60 },
});
