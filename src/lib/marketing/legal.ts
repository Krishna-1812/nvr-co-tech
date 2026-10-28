import { BRAND } from './content';
import { willMakerPublic } from '@/lib/will/flag';

/**
 * The words of the privacy policy and the terms.
 *
 * Here rather than in their pages because two things read them: the pages, and
 * the assistant, which is asked what the site does with somebody's data and has
 * to answer in the policy's own sentences rather than its own (lib/assist/site).
 */

export type Clause = {
  title: string;
  /** One paragraph, or several. An array renders as separate paragraphs. */
  body: string | string[];
};

export const PRIVACY_UPDATED = '28 October 2026';

/**
 * Rewritten on 20 Oct 2026 at the owner's request, broad rather than specific.
 * Broad is not the same as untrue: every sentence still has to hold for what
 * the site does today (components/Tracker, migrations 0032 and 0033, the
 * access request form, the session cookies), and the hedged ones ("may") are
 * there because the detail varies by tool and changes as tools are added, not
 * to cover something the site does not admit to.
 */
export const PRIVACY_CLAUSES: Clause[] = [
  {
    title: 'Information you give us',
    body: 'When you sign in, request access, write to us or otherwise share details with us, we receive what you provide, such as your name, email address, organisation and message.',
  },
  {
    title: 'Information collected automatically',
    body: 'When you use the website we record how it is used: for example the pages you open, how long you spend on them, how you arrived, and technical details such as your device, browser, approximate location and IP address. If you sign in, this may be linked to your account.',
  },
  {
    title: 'Information you enter into the tools',
    body: 'Depending on the tool, what you enter may be kept in your own browser, saved to your account when you are signed in, or processed on our servers to produce a result. Some tools work entirely within your browser.',
  },
  /*
   * Added 28 Oct 2026 with the chat on every page (app/api/chat). Each sentence
   * is what the code does: questions go to Anthropic to be answered; a
   * visitor's are kept in their own browser tab only, and a signed-in person's
   * are saved to their history (migration 0009), which they can delete.
   */
  {
    title: 'The assistant',
    body: 'When you ask the assistant a question, what you type and the conversation so far are sent to Anthropic, whose Claude model writes the answer. If you are not signed in, we do not keep your questions: the conversation stays in that browser tab. If you are signed in, it is saved to your account so you can come back to it, and you can delete it. Please do not type anything into it that you would not want to share.',
  },
  // Only once Will Maker is public: this page should not describe a tool that is not there.
  ...(willMakerPublic()
    ? [
        {
          title: 'Will Maker',
          body: 'Will Maker writes your will in your browser and keeps it there. It is not sent to us, and what you type or click in it is not recorded in our usage statistics (we do count that the page was opened). If you sign in and lock your will with a passcode, an encrypted copy is saved to your account that we cannot read, and we cannot recover a forgotten passcode. If you ask for an advocate’s help, we receive what you type in that request and the usual details of a visit, and nothing from your will.',
        },
      ]
    : []),
  {
    title: 'Cookies',
    body: 'We use cookies and similar storage to keep you signed in, remember your preferences and recognise returning visitors. You can clear or block cookies in your browser settings, though some features may not work without them.',
  },
  {
    title: 'How we use information',
    body: 'We use information to provide and run the website, to respond to you, to keep the website secure, to understand how it is used, and to improve it.',
  },
  {
    title: 'Sharing',
    body: 'We do not sell your personal information. We may share it with service providers who help us run the website, such as hosting and email providers, only as needed for them to do so, or where we are required to by law.',
  },
  {
    title: 'Storage and security',
    body: 'We take reasonable steps to protect the information we hold and to limit who can access it. No method of storing or sending information over the internet is completely secure, so we cannot guarantee absolute security.',
  },
  {
    title: 'Retention',
    body: 'We keep information for as long as it is needed for the purposes above, or as the law requires, and then delete it or keep it in a form that no longer identifies you.',
  },
  {
    title: 'Your choices',
    body: 'You can ask us what information we hold about you, and ask us to correct or delete it, by writing to us at the address below. If your browser sends a Do Not Track or Global Privacy Control signal, we do not record your visits.',
  },
  {
    title: 'Other websites',
    body: 'Links to other websites are provided for convenience. Their own privacy practices apply, and we are not responsible for them.',
  },
  {
    title: 'Changes to this policy',
    body: 'We may update this policy from time to time. The date at the top shows the current version, and continuing to use the website after a change means you accept it.',
  },
];

export const TERMS_UPDATED = '20 October 2026';

/**
 * Rewritten on 20 Oct 2026 at the owner's request, broad rather than specific,
 * after the pattern of the terms on free calculator sites: general information
 * only, results that are estimates, no advice, no warranty, and the usual
 * limits. Specific promises about how a tool works belong on that tool's page,
 * where they can be kept accurate; here they would only date.
 *
 * Governing law and jurisdiction are still not named. That is a decision for
 * the people whose company it is, not a sentence to be inferred.
 */
export const TERMS_CLAUSES: Clause[] = [
  {
    title: 'Acceptance of these terms',
    body: `By visiting or using ${BRAND.name}, including any of its tools, you agree to these terms. If you do not agree with them, please do not use the website. If you use it on behalf of an organisation, you confirm you are able to accept these terms for it.`,
  },
  {
    title: 'General information only',
    body: 'The content and tools on this website are provided for general information and convenience. They are not intended to be, and should not be taken as, financial, tax, legal, accounting or investment advice. You should consult a qualified professional before acting on anything you read or work out here.',
  },
  {
    title: 'Results are estimates',
    body: [
      'Calculations, summaries, matches and figures produced by the tools depend on the information you enter and on assumptions that may not fit your circumstances. They are indicative and may differ from the actual position.',
      'Rules, rates and practices change from time to time, and we do not guarantee that the website reflects the latest position. Please verify anything important independently before relying on it.',
    ],
  },
  {
    title: 'Using the website',
    body: 'You agree to use the website lawfully and only for its intended purpose, and not to interfere with its working, attempt to gain access to parts of it you are not permitted to use, or use it in a way that could harm us or anybody else. Some tools are available only to people we have given access to.',
  },
  {
    title: 'Accounts',
    body: 'Some features may need you to sign in. You are responsible for keeping your sign-in details private and for what happens under your account. We may suspend or close access where we reasonably believe these terms have not been followed.',
  },
  {
    title: 'Your information and content',
    body: `Anything you enter remains yours. How information is collected and used is described in our privacy policy, which forms part of these terms.`,
  },
  {
    title: 'Intellectual property',
    body: `The website, its design, text, graphics, tools and code belong to ${BRAND.name} or its licensors. You may use them for your own purposes, but you may not copy, reproduce, resell or redistribute them without our written permission.`,
  },
  {
    title: 'Links to other websites',
    body: 'The website may link to websites run by other people. We do not control them and are not responsible for their content, availability or practices. A link is not an endorsement.',
  },
  {
    title: 'No warranty',
    body: 'The website and its tools are provided "as is" and "as available". We try to keep them accurate and working, but we make no promise that they will be error free, complete, current or uninterrupted, and we may change or withdraw any part of them at any time without notice.',
  },
  {
    title: 'Limitation of liability',
    body: `To the extent the law allows, ${BRAND.name} and the people behind it are not liable for any loss or damage, direct or indirect, arising from your use of the website, its tools, or reliance on anything shown on it. Your use of the website is at your own risk.`,
  },
  {
    title: 'Indemnity',
    body: 'You agree to hold us harmless from claims arising out of your misuse of the website or your breach of these terms.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may revise these terms at any time by updating this page. The date at the top shows the current version, and continuing to use the website after a change means you accept it.',
  },
];
