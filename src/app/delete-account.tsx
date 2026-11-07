// Public page (no sign-in needed): how to delete a Luvdex account and its data.
// Google Play requires this web link in addition to deletion inside the app.
import { CONTACT_EMAIL, LegalPage, type LegalSection } from '@/components/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Delete your account in the app or on the website',
    bullets: [
      'Android or iPhone app: open Luvdex → My Entry → Account & settings → Delete account.',
      'Website: go to www.luvdex.com, sign in with the same Google or Apple account, then open My Entry → Account & settings → Delete account.',
      'Confirm, and your account is deleted straight away.',
    ],
  },
  {
    heading: "Can't sign in? Ask us by email",
    paragraphs: [
      `Email ${CONTACT_EMAIL} from the email address linked to your Luvdex account (your Google or Apple email), with the subject "Delete my Luvdex account". We may ask you to confirm the request, and we delete the account within 30 days.`,
    ],
  },
  {
    heading: 'What gets deleted',
    bullets: [
      'Your profile ("Entry"), photos and settings.',
      'Your location (we only ever keep your latest position).',
      'Your Luvballs, gold coins, referrals, matches and chat messages.',
      'Blocks and reports you made, and reports made about you.',
      'Your device-limit records, notification registrations and your login.',
    ],
  },
  {
    heading: 'What we may keep',
    paragraphs: [
      'Only what we are required to keep by law, and only for as long as the law requires. Backups of our database are overwritten automatically, so deleted data also disappears from them over time.',
    ],
  },
];

export default function DeleteAccount() {
  return (
    <LegalPage
      title="Delete your Luvdex account"
      intro="You can delete your Luvdex account and the data linked to it at any time. This page explains how, what is deleted and what we may keep. Luvdex is run by Solution and Network."
      sections={sections}
    />
  );
}
