import { CONTACT_EMAIL, LegalPage, type LegalSection } from '@/components/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      `Luvdex ("we", "us") is a location-based dating service available at luvdex.vercel.app and, later, as Android and iOS apps. You can contact us at ${CONTACT_EMAIL}.`,
      'Luvdex is being built in stages. This policy covers the features that exist today and the ones we are building. A feature that is not live yet collects nothing until it launches.',
    ],
  },
  {
    heading: 'Information we collect',
    bullets: [
      'Account information from Google when you sign in: your name, email address and profile picture.',
      'Profile information you choose to add: first name, date of birth, gender, what you are looking for, 1 to 4 photos, height, weight, education, work, a short bio, interests, languages, drinking and smoking habits.',
      'Your settings: filters (age, height, weight, relationship type), your visibility distance range and Ghost mode.',
      'Location: your precise location, only while you use the Radar. We keep only your latest position, never a history.',
      'Activity: Luvballs you throw, matches, chat messages, blocks and reports.',
      'Your Luvball and gold-coin balance, and referrals. Your referral code is your email address: anyone you share it with will see that email, and we use it only to credit referral coins.',
      'Technical information: device type, notification tokens, error reports and basic usage statistics that help us fix problems and improve the service.',
    ],
  },
  {
    heading: 'How we use your information',
    bullets: [
      'To create and run your account and show your profile ("Entry") to people near you who match your preferences and whose preferences you match.',
      'To work out who is nearby, check that a Luvball was thrown within 50 m, and create matches.',
      'To send notifications, such as "Someone nearby threw a Luvball at you", a new match or a new message.',
      'To keep people safe: enforcing blocks, reviewing reports, detecting fake accounts and location spoofing, and enforcing our Terms.',
      'To fix bugs and improve Luvdex.',
    ],
    paragraphs: ['We do not sell your personal information, and we do not use it for third-party advertising.'],
  },
  {
    heading: 'What other people can see',
    bullets: [
      'People nearby can see your Entry: first name, age, photos, what you are looking for, height, weight, education, work, bio and interests.',
      'They see only a rough distance (for example "100 to 250 m away") and an approximate position, never your exact location.',
      'They never see your email address, exact date of birth or location history.',
      'Luvballs are anonymous. The person you throw at is not told who threw it unless you both throw at each other and match.',
      'People you block cannot see you, and you cannot see them.',
    ],
  },
  {
    heading: 'Sensitive information and consent',
    paragraphs: [
      'Your location, dating preferences and photos are personal and can be sensitive. We collect them only with your consent: location access is requested through your device and can be turned off at any time, and profile details are provided by you. You can withdraw consent by changing your device settings, using Ghost mode, editing your profile or deleting your account.',
    ],
  },
  {
    heading: 'Who we share information with',
    paragraphs: ['We share information only with service providers that run Luvdex on our behalf, under their own security and privacy commitments:'],
    bullets: [
      'Supabase: database, sign-in and photo storage (servers in Mumbai, India).',
      'Vercel: website hosting.',
      'Google: "Sign in with Google" and, when the Radar launches, Google Maps.',
      'Notification, error-reporting and analytics providers, when we add them.',
    ],
  },
  {
    heading: 'How long we keep information',
    bullets: [
      'Location: only your latest position, deleted after 24 hours without activity.',
      'Luvballs: deleted after they expire (7 days).',
      'Profile, matches and messages: kept until you delete them or your account.',
      'Reports and safety records: kept as long as needed to protect users and meet legal obligations.',
      'When you delete your account, we delete your profile, photos, location, Luvballs, matches and messages, except for what we must keep by law.',
    ],
  },
  {
    heading: 'Your choices and rights',
    paragraphs: [
      `You can view and edit your profile at any time, pause your visibility with Ghost mode, block people and delete your account. Depending on where you live (for example under India's Digital Personal Data Protection Act, 2023, or the EU GDPR), you may have the right to access, correct or erase your data, withdraw consent and raise a complaint. To make a request, email ${CONTACT_EMAIL}. We will reply within 30 days.`,
    ],
  },
  {
    heading: 'Adults only',
    paragraphs: [
      'Luvdex is only for people aged 18 or over. We do not knowingly collect information from anyone under 18. If we learn that a user is under 18, we delete the account.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'We protect your data with database security rules, encrypted connections and limited access. Exact locations are never sent to other users. No system is perfectly secure, so please use a strong Google account password and tell us about anything suspicious.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      'We will update this page as Luvdex grows. If we make important changes, we will tell you in the app before they take effect.',
    ],
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information Luvdex collects, how we use it, who can see it, and the choices you have."
      sections={sections}
    />
  );
}
