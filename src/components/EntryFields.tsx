import { StyleSheet, Text, View } from 'react-native';

import { ChipMulti, ChipSelect, FieldLabel, Segmented, TextField, formStyles } from '@/components/Form';
import {
  BIO_MAX,
  EDUCATION,
  GENDERS,
  HABITS,
  HEIGHT_RANGE,
  INTERESTS,
  LANGUAGES,
  LOOKING_FOR,
  MAX_INTERESTS,
  WEIGHT_RANGE,
  ageFrom,
  cmToFtIn,
  ftInToCm,
  kgToLb,
  lbToKg,
  toIsoDate,
  type Education,
  type Gender,
  type Habit,
  type LookingFor,
  type Profile,
  type Units,
} from '@/lib/entry';
import { colors, fonts } from '@/lib/theme';

/** Everything the Entry forms edit, kept as raw input strings until saved. */
export type EntryDraft = {
  first_name: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  gender: Gender | null;
  looking_for: LookingFor | null;
  units: Units;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string; // kg or lb depending on units
  education_level: Education | null;
  school: string;
  job_title: string;
  company: string;
  bio: string;
  interests: string[];
  languages: string[];
  drinking: Habit | null;
  smoking: Habit | null;
};

type FieldProps = { draft: EntryDraft; update: (patch: Partial<EntryDraft>) => void };

export function emptyDraft(firstName = ''): EntryDraft {
  return {
    first_name: firstName,
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    gender: null,
    looking_for: null,
    units: 'metric',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weight: '',
    education_level: null,
    school: '',
    job_title: '',
    company: '',
    bio: '',
    interests: [],
    languages: [],
    drinking: null,
    smoking: null,
  };
}

export function draftFromProfile(p: Profile): EntryDraft {
  const [y, m, d] = p.birthdate.split('-');
  const { ft, inch } = cmToFtIn(p.height_cm);
  return {
    first_name: p.first_name,
    dobDay: d,
    dobMonth: m,
    dobYear: y,
    gender: p.gender,
    looking_for: p.looking_for,
    units: p.units,
    heightCm: String(p.height_cm),
    heightFt: String(ft),
    heightIn: String(inch),
    weight: String(p.units === 'metric' ? p.weight_kg : kgToLb(p.weight_kg)),
    education_level: p.education_level,
    school: p.school ?? '',
    job_title: p.job_title ?? '',
    company: p.company ?? '',
    bio: p.bio ?? '',
    interests: p.interests,
    languages: p.languages,
    drinking: p.drinking,
    smoking: p.smoking,
  };
}

const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);
const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

/** Converts the height/weight inputs to cm/kg, or null when missing. */
export function bodyFromDraft(d: EntryDraft): { height_cm: number | null; weight_kg: number | null } {
  const height_cm =
    d.units === 'metric'
      ? d.heightCm ? Number(d.heightCm) : null
      : d.heightFt ? ftInToCm(Number(d.heightFt), Number(d.heightIn || 0)) : null;
  const weight_kg = d.weight ? (d.units === 'metric' ? Number(d.weight) : lbToKg(Number(d.weight))) : null;
  return { height_cm, weight_kg };
}

export function optionalFieldsFromDraft(d: EntryDraft) {
  return {
    education_level: d.education_level,
    school: blankToNull(d.school),
    job_title: blankToNull(d.job_title),
    company: blankToNull(d.company),
    bio: blankToNull(d.bio),
    interests: d.interests,
    languages: d.languages,
    drinking: d.drinking,
    smoking: d.smoking,
  };
}

// ------------------------------------------------------------- validation per section
export function validateBasics(d: EntryDraft): string | null {
  if (!d.first_name.trim()) return 'Please enter your first name.';
  if (d.first_name.trim().length > 30) return 'First name can be at most 30 characters.';
  const iso = toIsoDate(d.dobDay, d.dobMonth, d.dobYear);
  if (!iso) return 'Please enter a real date of birth (DD / MM / YYYY).';
  if (Number(d.dobYear) < 1900) return 'Please enter a real date of birth.';
  if (ageFrom(iso) < 18) return 'Luvdex is only for adults aged 18 or over.';
  if (!d.gender) return 'Please choose your gender.';
  return null;
}

export function validateLookingFor(d: EntryDraft): string | null {
  return d.looking_for ? null : 'Please choose what you are looking for.';
}

export function validateBody(d: EntryDraft): string | null {
  const { height_cm, weight_kg } = bodyFromDraft(d);
  if (!height_cm || height_cm < HEIGHT_RANGE.min || height_cm > HEIGHT_RANGE.max)
    return d.units === 'metric'
      ? `Please enter a height between ${HEIGHT_RANGE.min} and ${HEIGHT_RANGE.max} cm.`
      : 'Please enter a height between 3′11″ and 7′7″.';
  if (d.units === 'imperial' && Number(d.heightIn || 0) > 11) return 'Inches must be between 0 and 11.';
  if (!weight_kg || weight_kg < WEIGHT_RANGE.min || weight_kg > WEIGHT_RANGE.max)
    return d.units === 'metric'
      ? `Please enter a weight between ${WEIGHT_RANGE.min} and ${WEIGHT_RANGE.max} kg.`
      : `Please enter a weight between ${kgToLb(WEIGHT_RANGE.min)} and ${kgToLb(WEIGHT_RANGE.max)} lb.`;
  return null;
}

export function validateAbout(d: EntryDraft): string | null {
  if (d.bio.length > BIO_MAX) return `Your description can be at most ${BIO_MAX} characters.`;
  return null;
}

// ------------------------------------------------------------- sections
export function BasicsFields({ draft, update, locked }: FieldProps & { locked?: boolean }) {
  return (
    <>
      <View style={formStyles.group}>
        <FieldLabel hint="Shown on your Entry">First name</FieldLabel>
        <TextField
          value={draft.first_name}
          onChangeText={(t) => update({ first_name: t.slice(0, 30) })}
          placeholder="e.g. Priya"
          autoComplete="given-name"
          autoCapitalize="words"
        />
      </View>
      {!locked ? (
        <>
          <View style={formStyles.group}>
            <FieldLabel hint="Only your age is shown">Date of birth</FieldLabel>
            <View style={formStyles.row}>
              <TextField
                style={styles.dd}
                value={draft.dobDay}
                onChangeText={(t) => update({ dobDay: digits(t, 2) })}
                placeholder="DD"
                keyboardType="number-pad"
                accessibilityLabel="Day of birth"
              />
              <TextField
                style={styles.dd}
                value={draft.dobMonth}
                onChangeText={(t) => update({ dobMonth: digits(t, 2) })}
                placeholder="MM"
                keyboardType="number-pad"
                accessibilityLabel="Month of birth"
              />
              <TextField
                style={styles.yyyy}
                value={draft.dobYear}
                onChangeText={(t) => update({ dobYear: digits(t, 4) })}
                placeholder="YYYY"
                keyboardType="number-pad"
                accessibilityLabel="Year of birth"
              />
            </View>
          </View>
          <View style={formStyles.group}>
            <FieldLabel>I am a</FieldLabel>
            <ChipSelect options={GENDERS} value={draft.gender} onChange={(v) => update({ gender: v })} />
            <Text style={styles.note}>Date of birth and gender can't be changed later.</Text>
          </View>
        </>
      ) : null}
    </>
  );
}

export function LookingForFields({ draft, update }: FieldProps) {
  return (
    <View style={formStyles.group}>
      <ChipSelect options={LOOKING_FOR} value={draft.looking_for} onChange={(v) => update({ looking_for: v })} />
      <Text style={styles.note}>This becomes the coloured "type" badge on your Entry.</Text>
    </View>
  );
}

export function BodyFields({ draft, update }: FieldProps) {
  const switchUnits = (units: Units) => {
    if (units === draft.units) return;
    const { height_cm, weight_kg } = bodyFromDraft(draft);
    const patch: Partial<EntryDraft> = { units };
    if (height_cm) {
      const { ft, inch } = cmToFtIn(height_cm);
      Object.assign(patch, { heightCm: String(height_cm), heightFt: String(ft), heightIn: String(inch) });
    }
    if (weight_kg) patch.weight = String(units === 'metric' ? weight_kg : kgToLb(weight_kg));
    update(patch);
  };

  return (
    <>
      <View style={formStyles.group}>
        <Segmented
          options={[
            { value: 'metric', label: 'cm · kg' },
            { value: 'imperial', label: 'ft · lb' },
          ]}
          value={draft.units}
          onChange={switchUnits}
        />
      </View>
      <View style={formStyles.group}>
        <FieldLabel>Height</FieldLabel>
        {draft.units === 'metric' ? (
          <View style={formStyles.row}>
            <TextField
              style={styles.flex}
              value={draft.heightCm}
              onChangeText={(t) => update({ heightCm: digits(t, 3) })}
              placeholder="e.g. 168"
              keyboardType="number-pad"
              accessibilityLabel="Height in centimetres"
            />
            <Text style={styles.unit}>cm</Text>
          </View>
        ) : (
          <View style={formStyles.row}>
            <TextField
              style={styles.flex}
              value={draft.heightFt}
              onChangeText={(t) => update({ heightFt: digits(t, 1) })}
              placeholder="5"
              keyboardType="number-pad"
              accessibilityLabel="Height feet"
            />
            <Text style={styles.unit}>ft</Text>
            <TextField
              style={styles.flex}
              value={draft.heightIn}
              onChangeText={(t) => update({ heightIn: digits(t, 2) })}
              placeholder="6"
              keyboardType="number-pad"
              accessibilityLabel="Height inches"
            />
            <Text style={styles.unit}>in</Text>
          </View>
        )}
      </View>
      <View style={formStyles.group}>
        <FieldLabel>Weight</FieldLabel>
        <View style={formStyles.row}>
          <TextField
            style={styles.flex}
            value={draft.weight}
            onChangeText={(t) => update({ weight: digits(t, 3) })}
            placeholder={draft.units === 'metric' ? 'e.g. 60' : 'e.g. 132'}
            keyboardType="number-pad"
            accessibilityLabel={draft.units === 'metric' ? 'Weight in kilograms' : 'Weight in pounds'}
          />
          <Text style={styles.unit}>{draft.units === 'metric' ? 'kg' : 'lb'}</Text>
        </View>
      </View>
    </>
  );
}

export function WorkFields({ draft, update }: FieldProps) {
  return (
    <>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Education</FieldLabel>
        <ChipSelect
          options={EDUCATION}
          value={draft.education_level}
          onChange={(v) => update({ education_level: v })}
          clearable
        />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">College or school</FieldLabel>
        <TextField value={draft.school} onChangeText={(t) => update({ school: t.slice(0, 80) })} placeholder="e.g. IIT Bombay" />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Job title</FieldLabel>
        <TextField value={draft.job_title} onChangeText={(t) => update({ job_title: t.slice(0, 60) })} placeholder="e.g. Designer" />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Company</FieldLabel>
        <TextField value={draft.company} onChangeText={(t) => update({ company: t.slice(0, 60) })} placeholder="e.g. Acme Studio" />
      </View>
    </>
  );
}

export function AboutFields({ draft, update }: FieldProps) {
  return (
    <>
      <View style={formStyles.group}>
        <FieldLabel hint={`${draft.bio.length}/${BIO_MAX}`}>Entry description</FieldLabel>
        <TextField
          value={draft.bio}
          onChangeText={(t) => update({ bio: t.slice(0, BIO_MAX) })}
          placeholder="A line or two about you. What would make someone throw a Luvball?"
          multiline
        />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint={`${draft.interests.length}/${MAX_INTERESTS}`}>Interests</FieldLabel>
        <ChipMulti options={INTERESTS} values={draft.interests} onChange={(v) => update({ interests: v })} max={MAX_INTERESTS} />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Languages you speak</FieldLabel>
        <ChipMulti options={LANGUAGES} values={draft.languages} onChange={(v) => update({ languages: v })} max={10} />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Drinking</FieldLabel>
        <ChipSelect options={HABITS} value={draft.drinking} onChange={(v) => update({ drinking: v })} clearable />
      </View>
      <View style={formStyles.group}>
        <FieldLabel hint="Optional">Smoking</FieldLabel>
        <ChipSelect options={HABITS} value={draft.smoking} onChange={(v) => update({ smoking: v })} clearable />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dd: { width: 70, textAlign: 'center' },
  yyyy: { width: 96, textAlign: 'center' },
  flex: { flex: 1 },
  unit: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.inkSoft, alignSelf: 'center', minWidth: 22 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 8 },
});
