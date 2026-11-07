import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import { fetchMyProfile, type Profile } from './entry';

type ProfileState = {
  profile: Profile | null;
  /** True until the signed-in user's Entry has been looked up. */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Profile | null>;
  setProfile: (p: Profile | null) => void;
};

const ProfileContext = createContext<ProfileState>({
  profile: null,
  loading: true,
  error: null,
  refresh: async () => null,
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Which user the current `profile` belongs to; until it matches, we are still loading.
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoadedFor(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const p = await fetchMyProfile(userId);
      setProfile(p);
      setError(null);
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your Entry.');
      return null;
    } finally {
      setLoadedFor(userId);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return (
    <ProfileContext.Provider
      value={{ profile, loading: authLoading || loading || loadedFor !== (userId ?? null), error, refresh, setProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
