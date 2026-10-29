import { BRAND, type ToolBrief } from '@/lib/marketing/brand';
import type { Suggestion } from './suggestions';

/**
 * What the public chat offers to ask before anything has been asked.
 *
 * Chosen by the page the visitor is on, because the question somebody has on a
 * tool's page is about that tool, and on the privacy policy it is about their
 * data. Four at most: enough to show the range (the product, their data,
 * access, a person) without turning an empty chat into a menu.
 *
 * `open` is the slugs anybody may use, passed down from the server
 * (lib/access) rather than imported here, since this runs in the browser and
 * the access module holds the admins' addresses. `tools` is the roster, passed
 * down for the same reason: content.ts would bring every tool's description
 * into the browser with it.
 */
export function visitorSuggestions(path: string, open: readonly string[], tools: readonly ToolBrief[]): Suggestion[] {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  const toolPage = /^\/tools\/([a-z0-9-]+)$/.exec(clean)?.[1];
  const inside = tools.find((a) => a.href && (clean === a.href || clean.startsWith(`${a.href}/`)));
  const agent = tools.find((a) => a.slug === toolPage) ?? inside;

  if (agent) {
    const free = open.includes(agent.slug);
    return [
      { label: `What does ${agent.name} do?`, question: `What does ${agent.name} do, in plain words?` },
      free
        ? { label: 'Do I need an account?', question: `Can I use ${agent.name} without an account, and is it free?` }
        : { label: 'How do I get access?', question: `How do I get access to ${agent.name}?` },
      { label: 'Is my data safe?', question: `Where does what I enter into ${agent.name} go, and who can see it?` },
      { label: 'Is there a guide?', question: `Is there a guide on this site that goes with ${agent.name}?` },
    ];
  }

  if (clean.startsWith('/guides/')) {
    return [
      { label: 'Sum this guide up', question: 'Sum up the guide I am reading in three short lines.' },
      { label: 'Which tool does this?', question: 'Which tool on this site works this out for me?' },
      { label: 'Other guides', question: 'Which other guides are on this site?' },
    ];
  }

  if (clean === '/privacy' || clean === '/terms') {
    return [
      { label: 'What do you keep about me?', question: 'What information do you keep about me, and can I have it deleted?' },
      { label: 'Do you use cookies?', question: 'Do you use cookies, and what for?' },
      { label: 'Is this advice?', question: 'Is anything on this site financial, tax or legal advice?' },
    ];
  }

  return [
    { label: `What is ${BRAND.name}?`, question: `What is ${BRAND.name}, and who is it for?` },
    { label: 'What can I use for free?', question: 'Which tools can I use for free, without an account?' },
    { label: 'Is my data safe?', question: 'Is my financial data safe here? Where does it go?' },
    { label: 'Talk to a person', question: 'How do I talk to the team or book a walkthrough?' },
  ];
}
