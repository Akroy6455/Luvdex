import { CONTACT_EMAIL, LegalPage, type LegalSection } from '@/components/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Agreeing to these terms',
    paragraphs: [
      'By creating an account or using Luvdex, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use Luvdex.',
    ],
  },
  {
    heading: 'Who can use Luvdex',
    bullets: [
      'You must be at least 18 years old.',
      'You may have only one account, and the information you give must be true and about you.',
      'You must not use Luvdex if you have been banned from it before, or if you are legally prohibited from using it.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'You sign in with your Google account. You are responsible for keeping it secure and for activity on your Luvdex account. Tell us straight away if you think someone else has accessed it.',
    ],
  },
  {
    heading: 'Community rules',
    paragraphs: ['To keep Luvdex safe and respectful, you must not:'],
    bullets: [
      'Harass, threaten, stalk, intimidate or follow anyone, online or in person.',
      'Use Luvdex to locate, track or show up uninvited where someone is.',
      'Post nudity, sexual content, violence, hate speech or anything illegal.',
      'Impersonate anyone, use someone else\'s photos, or create fake accounts.',
      'Fake your location, use bots or scrapers, or try to work out other users\' exact locations.',
      'Advertise, sell, solicit money, or use Luvdex for any commercial purpose.',
      'Attempt to hack, overload or interfere with the service.',
    ],
  },
  {
    heading: 'Your content',
    paragraphs: [
      'You own the photos and text you add. You allow Luvdex to store, display and process this content so we can run the service, for example showing your Entry to people nearby. You confirm you have the right to share it. We may remove content that breaks these terms.',
    ],
  },
  {
    heading: 'Meeting people in person',
    paragraphs: [
      'Luvdex shows people who are physically near you. You are responsible for your own interactions. We do not run criminal background checks and cannot guarantee anyone\'s identity or intentions. Meet in public places, tell a friend where you are going, and block and report anyone who makes you uncomfortable.',
    ],
  },
  {
    heading: 'Luvballs, gold coins and referrals',
    bullets: [
      'Luvballs and gold coins are virtual items for use inside Luvdex only. They have no cash value and cannot be sold, transferred or exchanged for money.',
      'New accounts start with 3 Luvballs and 100 gold coins. You receive 1 free Luvball each month, up to a maximum of 12. 300 gold coins buy 1 Luvball.',
      'If a friend creates an account with your referral code, you each receive 100 gold coins. Referral bonuses for the person who invited are limited to 20 every 30 days.',
      'Creating fake or duplicate accounts to collect coins is not allowed. We may remove coins, Luvballs or accounts gained this way.',
      'We may change these amounts or how they work. We will tell you in the app before important changes.',
    ],
  },
  {
    heading: 'Blocking, reporting and enforcement',
    paragraphs: [
      'You can block or report anyone. We review reports and may warn, suspend or permanently ban accounts that break these terms, with or without notice. We may also report illegal activity to the authorities.',
    ],
  },
  {
    heading: 'Ending your account',
    paragraphs: [
      `You can delete your account at any time in the app, or by emailing ${CONTACT_EMAIL}. We may close accounts that break these terms or put other users at risk.`,
    ],
  },
  {
    heading: 'The service is provided "as is"',
    paragraphs: [
      'Luvdex is new and still being built. Features may change, pause or stop, and it may sometimes be unavailable or contain errors. To the extent the law allows, we make no promises that you will find a match or that the service will be uninterrupted. We are not responsible for the conduct of any user, on or off Luvdex. Our total liability to you is limited to the amount you have paid us in the last 12 months, if any.',
    ],
  },
  {
    heading: 'Changes to these terms',
    paragraphs: [
      'We may update these terms as Luvdex grows. If we make important changes, we will tell you in the app. Continuing to use Luvdex after changes take effect means you accept them.',
    ],
  },
  {
    heading: 'Governing law',
    paragraphs: ['These terms are governed by the laws of India, without affecting any rights you have under the laws of the country where you live.'],
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms are the rules for using Luvdex. Please read them carefully: they include important safety responsibilities for meeting people nearby."
      sections={sections}
    />
  );
}
