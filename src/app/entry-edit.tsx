import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShellButton } from '@/components/Buttons';
import { DeviceFrame } from '@/components/DeviceFrame';
import {
  AboutFields,
  BasicsFields,
  BodyFields,
  LookingForFields,
  WorkFields,
  bodyFromDraft,
  draftFromProfile,
  optionalFieldsFromDraft,
  validateAbout,
  validateBasics,
  validateBody,
  validateLookingFor,
  type EntryDraft,
} from '@/components/EntryFields';
import { ErrorText } from '@/components/Form';
import { PhotoGrid, pickPhotos } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import {
  MAX_PHOTOS,
  deletePhoto,
  fetchMyPhotos,
  setPhotoOrder,
  updateProfile,
  uploadPhoto,
  type Photo,
} from '@/lib/entry';
import { useProfile } from '@/lib/profile';
import { colors, fonts } from '@/lib/theme';

export default function EditEntry() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading, setProfile } = useProfile();
  const userId = session?.user.id;

  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && !draft) setDraft(draftFromProfile(profile));
  }, [profile, draft]);

  useEffect(() => {
    if (userId) fetchMyPhotos(userId).then(setPhotos).catch(() => setPhotoError('Could not load your photos.'));
  }, [userId]);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (!profileLoading && session && !profile?.onboarding_done) return <Redirect href="/onboarding" />;
  if (!draft || !userId) return <DeviceFrame><Text style={styles.muted}>Loading…</Text></DeviceFrame>;

  const update = (patch: Partial<EntryDraft>) => setDraft({ ...draft, ...patch });

  // Photo changes are saved straight away.
  const runPhotoChange = async (change: () => Promise<void>) => {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await change();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Something went wrong with your photos.');
    } finally {
      setPhotos(await fetchMyPhotos(userId).catch(() => photos));
      setPhotoBusy(false);
    }
  };

  const addPhotos = () =>
    runPhotoChange(async () => {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      for (let i = 0; i < picked.length; i++) await uploadPhoto(userId, picked[i], photos.length + i);
    });

  const removePhoto = (index: number) => {
    if (photos.length <= 1) {
      setPhotoError('Your Entry needs at least one photo. Add another before removing this one.');
      return;
    }
    runPhotoChange(async () => {
      await deletePhoto(photos[index]);
      await setPhotoOrder(photos.filter((_, j) => j !== index).map((p) => p.id));
    });
  };

  const makeMain = (index: number) =>
    runPhotoChange(() => setPhotoOrder([photos[index].id, ...photos.filter((_, j) => j !== index).map((p) => p.id)]));

  const save = async () => {
    const problem = validateBasics(draft) ?? validateLookingFor(draft) ?? validateBody(draft) ?? validateAbout(draft);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const { height_cm, weight_kg } = bodyFromDraft(draft);
      const saved = await updateProfile(userId, {
        first_name: draft.first_name.trim(),
        looking_for: draft.looking_for!,
        height_cm: height_cm!,
        weight_kg: weight_kg!,
        units: draft.units,
        ...optionalFieldsFromDraft(draft),
      });
      setProfile(saved);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <DeviceFrame
      footer={
        <>
          <ShellButton label="Save changes" onPress={save} busy={saving} disabled={photoBusy} />
          <ShellButton variant="ghost" label="Cancel" onPress={() => router.replace('/home')} />
        </>
      }
    >
      <Text style={styles.kicker}>EDIT MY ENTRY</Text>

      <Section title="Photos" note="Changes to photos are saved immediately.">
        <PhotoGrid
          photos={photos.map((p) => ({ key: p.id, uri: p.url }))}
          onAdd={addPhotos}
          onRemove={removePhoto}
          onMakeMain={makeMain}
          busy={photoBusy}
        />
        <ErrorText>{photoError}</ErrorText>
      </Section>

      <Section title="Name">
        <BasicsFields draft={draft} update={update} locked />
      </Section>
      <Section title="Looking for">
        <LookingForFields draft={draft} update={update} />
      </Section>
      <Section title="Height & weight">
        <BodyFields draft={draft} update={update} />
      </Section>
      <Section title="Work & education">
        <WorkFields draft={draft} update={update} />
      </Section>
      <Section title="About you">
        <AboutFields draft={draft} update={update} />
      </Section>

      <ErrorText>{error}</ErrorText>
    </DeviceFrame>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.muted}>{note}</Text> : null}
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  section: { marginTop: 18, paddingTop: 14, borderTopWidth: 2, borderTopColor: colors.screenEdge },
  sectionTitle: { fontFamily: fonts.bodyHeavy, fontSize: 20, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
