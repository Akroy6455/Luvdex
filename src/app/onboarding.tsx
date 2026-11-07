import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  emptyDraft,
  optionalFieldsFromDraft,
  validateAbout,
  validateBasics,
  validateBody,
  validateLookingFor,
  type EntryDraft,
} from '@/components/EntryFields';
import { ErrorText, FieldLabel, TextField, formStyles } from '@/components/Form';
import { PhotoGrid, pickPhotos } from '@/components/PhotoGrid';
import { useAuth } from '@/lib/auth';
import {
  MAX_PHOTOS,
  deletePhoto,
  fetchMyPhotos,
  toIsoDate,
  updateProfile,
  uploadPhoto,
  upsertProfile,
  type LocalPhoto,
} from '@/lib/entry';
import { checkReferralCode, claimReferral } from '@/lib/luvballs';
import { useProfile } from '@/lib/profile';
import { colors, fonts } from '@/lib/theme';

type Step = { title: string; intro: string; validate?: (d: EntryDraft, photos: LocalPhoto[]) => string | null };

const STEPS: Step[] = [
  { title: 'The basics', intro: "Let's start your Luvdex Entry.", validate: (d) => validateBasics(d) },
  { title: 'What are you looking for?', intro: 'Be honest. It helps the right people find you.', validate: (d) => validateLookingFor(d) },
  {
    title: 'Add your photos',
    intro: 'Add 1 to 4 clear photos of you. The first one is your main photo.',
    validate: (_d, photos) => (photos.length ? null : 'Please add at least one photo.'),
  },
  { title: 'Height & weight', intro: 'These appear in the stats panel of your Entry.', validate: (d) => validateBody(d) },
  { title: 'Work & education', intro: 'All optional. Share what you like.' },
  { title: 'About you', intro: 'The finishing touches.', validate: (d) => validateAbout(d) },
];

export default function Onboarding() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading, setProfile } = useProfile();

  const googleFirstName = useMemo(() => {
    const meta = session?.user.user_metadata ?? {};
    return String(meta.given_name ?? meta.full_name ?? meta.name ?? '').split(' ')[0].slice(0, 30);
  }, [session]);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [photos, setPhotos] = useState<(LocalPhoto & { key: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [referral, setReferral] = useState('');

  if (!authLoading && !session) return <Redirect href="/welcome" />;
  if (!loading && profile?.onboarding_done) return <Redirect href="/radar" />;
  if (loading || !session) return <DeviceFrame><Text style={styles.loading}>Loading…</Text></DeviceFrame>;

  // Start from an unfinished Entry if there is one, otherwise from the Google first name.
  const current = draft ?? (profile ? draftFromProfile(profile) : emptyDraft(googleFirstName));
  const update = (patch: Partial<EntryDraft>) => setDraft({ ...current, ...patch });
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const addPhotos = async () => {
    setError(null);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      setPhotos((prev) =>
        [...prev, ...picked.map((p, i) => ({ ...p, key: `${Date.now()}-${i}` }))].slice(0, MAX_PHOTOS),
      );
    } catch {
      setError('Could not open your photos. Please try again.');
    }
  };

  const finish = async () => {
    const uid = session.user.id;
    const birthdate = toIsoDate(current.dobDay, current.dobMonth, current.dobYear)!;
    const { height_cm, weight_kg } = bodyFromDraft(current);
    setSaving('Saving your Entry…');
    try {
      await upsertProfile({
        id: uid,
        first_name: current.first_name.trim(),
        birthdate,
        gender: current.gender!,
        interested_in: [current.gender === 'man' ? 'woman' : 'man'],
        looking_for: current.looking_for!,
        height_cm: height_cm!,
        weight_kg: weight_kg!,
        units: current.units,
        ...optionalFieldsFromDraft(current),
        onboarding_done: false,
      });
      // Clear photos left over from an earlier, interrupted attempt.
      for (const old of await fetchMyPhotos(uid)) await deletePhoto(old);
      for (let i = 0; i < photos.length; i++) {
        setSaving(`Uploading photo ${i + 1} of ${photos.length}…`);
        await uploadPhoto(uid, photos[i], i);
      }
      const done = await updateProfile(uid, { onboarding_done: true });
      // Referral bonus (+100 gold coins each). The code was checked before saving.
      if (referral.trim()) {
        setSaving('Adding your referral bonus…');
        await claimReferral(referral).catch(() => undefined);
      }
      setProfile(done);
      router.replace('/radar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSaving(null);
    }
  };

  const next = async () => {
    const problem = s.validate?.(current, photos) ?? null;
    setError(problem);
    if (problem) return;
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    const code = referral.trim();
    if (code) {
      if (code.toLowerCase() === (session.user.email ?? '').toLowerCase()) {
        setError("That's your own email. Enter the email of the friend who invited you, or leave it empty.");
        return;
      }
      setSaving('Checking referral code…');
      const ok = await checkReferralCode(code).catch(() => false);
      setSaving(null);
      if (!ok) {
        setError(
          "That referral code can't be used. Check the email, or leave it empty. (Codes don't work between two accounts on the same phone.)",
        );
        return;
      }
    }
    finish();
  };

  const back = () => {
    setError(null);
    setStep(Math.max(0, step - 1));
  };

  return (
    <DeviceFrame
      scrollKey={step}
      footer={
        <>
          <ShellButton
            label={saving ?? (isLast ? 'Create my Entry ♥' : 'Next')}
            onPress={next}
            disabled={!!saving}
          />
          {step > 0 && !saving ? <ShellButton variant="ghost" label="Back" onPress={back} /> : null}
        </>
      }
    >
      <View style={styles.progressRow}>
        <Text style={styles.stepNo}>
          STEP {step + 1} OF {STEPS.length}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>

      <Text style={formStyles.stepTitle}>{s.title}</Text>
      <Text style={formStyles.stepIntro}>{s.intro}</Text>

      {step === 0 && <BasicsFields draft={current} update={update} />}
      {step === 1 && <LookingForFields draft={current} update={update} />}
      {step === 2 && (
        <View style={formStyles.group}>
          <PhotoGrid
            photos={photos.map((p) => ({ key: p.key, uri: p.uri }))}
            onAdd={addPhotos}
            onRemove={(i) => setPhotos(photos.filter((_, j) => j !== i))}
            onMakeMain={(i) => setPhotos([photos[i], ...photos.filter((_, j) => j !== i)])}
          />
          <Text style={styles.note}>
            Photos are resized and their hidden location data is removed before upload.
          </Text>
        </View>
      )}
      {step === 3 && <BodyFields draft={current} update={update} />}
      {step === 4 && <WorkFields draft={current} update={update} />}
      {step === 5 && (
        <>
          <AboutFields draft={current} update={update} />
          <View style={[formStyles.group, styles.referral]}>
            <FieldLabel hint="Optional">Invited by a friend?</FieldLabel>
            <TextField
              value={referral}
              onChangeText={setReferral}
              placeholder="Their email address (referral code)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
            />
            <Text style={styles.note}>You both get 🪙 100 gold coins when your Entry is created.</Text>
          </View>
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </DeviceFrame>
  );
}

const styles = StyleSheet.create({
  loading: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.inkSoft },
  progressRow: { marginBottom: 14, gap: 8 },
  stepNo: { fontFamily: fonts.pixel, fontSize: 11, color: colors.inkSoft, letterSpacing: 1 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.white, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.luvRed, borderRadius: 4 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 10 },
  referral: { marginTop: 22, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEA', borderWidth: 2, borderColor: colors.sparkYellow },
});
