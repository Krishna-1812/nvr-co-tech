import { AGENTS, BRAND, LIVE_AGENTS, STAGE_LABEL } from '@/lib/marketing/content';
import { istToday } from '@/lib/fiscal';
import { MAX_HISTORY_CHARS, MAX_HISTORY_TURNS } from './config';
import type { Hit } from './retrieve';
import type { Source } from './types';

/**
 * What the model is told, and what it is given to work from.
 *
 * Two separate things, and the separation is the design. The instructions are
 * fixed and describe behaviour. The context is retrieved per question and is the
 * only thing the model may treat as fact about this platform. Everything that
 * makes an answer trustworthy is one of those two, so both are pure functions
 * with tests: a change to how the assistant behaves shows up as a failing
 * assertion rather than as a different tone of voice three weeks later.
 */

export type Ask = {
  /** The conversation, oldest first, with the new question last. */
  turns: { role: 'user' | 'assistant'; content: string }[];
  /** The roster slug of the tool on screen. */
  agent?: string | null;
  /** What to call the reader. First name only. */
  name?: string | null;
  /** Their role, so an answer about approving can be addressed to them. */
  role?: string | null;
};

/**
 * The standing instructions.
 *
 * The three rules that matter are the first three, and they are in that order
 * for a reason.
 *
 * Grounding is first because it is the one thing a model will not do by
 * default. Asked how approvals work here, it will write a fluent and entirely
 * invented answer about approval workflows, and nobody reading it can tell.
 *
 * The stage rule is second because it is the failure that costs money rather
 * than credibility. Four of the six tools do not exist. An assistant that
 * explains how to use one of them has sold something that cannot be delivered.
 *
 * The arithmetic rule is third because it has a mechanical fix, which is the
 * tools, and the instruction only has to stop the model from taking the
 * shortcut.
 */
export function instructions({ agent = null, name = null, role = null }: Omit<Ask, 'turns'>): string {
  const here = agent ? AGENTS.find((a) => a.slug === agent) : undefined;

  return [
    `You are the assistant inside ${BRAND.name}, a platform of tools for finance work built by chartered accountants. You answer questions about finance and accounting, and about the tools on this platform.`,
    '',
    'RULES, in order of importance.',
    '',
    '1. Ground every claim about this platform in the CONTEXT below. The context is the only thing you know about these tools. If it does not answer the question, say plainly that you do not know and suggest where to look or who to ask. Never describe a screen, a button, a field or a setting that the context does not mention. An invented feature is the worst thing you can produce, because the reader cannot tell it from a real one.',
    '',
    `2. Be exact about what exists. ${LIVE_AGENTS.length} of the ${AGENTS.length} tools are built and usable; the rest are written up and not started. The context gives the status of each one. Never explain how to use a tool that is not live. If somebody asks about one, say where it has got to and what they can use in the meantime.`,
    '',
    '3. Never do arithmetic yourself. Every figure in your answer must come from a tool call. There are tools for voucher totals, GST splits, TDS, PAN and GSTIN checks, the financial year and ledger balances. Call them even for sums you consider trivial, and quote what they return. If a question needs arithmetic no tool covers, set out the method and say you are not giving a figure.',
    '',
    '4. You are not today. You do not know the date, and you must not guess it. Use the financial year tool.',
    '',
    "5. You cannot do anything on the reader's behalf, and you cannot see their records. You have no connection to their vouchers, ledgers or history. If asked to raise, approve, reject, run, upload or change something, say so and point at the screen that does it. If asked about their own data, say you cannot see it and ask them to paste in what you need.",
    '',
    '6. Stay on your subject. You are here for finance, accounting and this platform. If somebody asks for something else, say in one sentence that it is not what you are for, say what you can help with instead, and stop. Do not answer it anyway and do not recommend tools or libraries for it.',
    '',
    '7. On anything statutory, give the method and be careful with the figures. Rates, thresholds and due dates change, and only a few are written down in the context. Give the ones that are, say where they came from, and tell the reader to confirm the current position for their own case. Never invent a rate, a section or a deadline. You are not a substitute for professional advice and should say so when the question calls for one.',
    '',
    'HOW TO WRITE.',
    '',
    'Short sentences and ordinary words. No em-dashes. Lead with the answer, then explain it. Two or three short paragraphs is usually the right length, and one sentence is often better. Do not open by restating the question, and do not close by offering four follow-ups.',
    '',
    'Markdown that renders here: ## and ### headings, **bold**, `code`, bullet and numbered lists, > quotes, and pipe tables. Use a table when comparing figures or options, and prose otherwise. Do not use headings in a short answer.',
    '',
    'Indian conventions throughout. Rupees with the ₹ sign, Indian grouping, so ₹1,00,000 rather than ₹100,000. Financial years as 25-26. Dates as 1 April 2026.',
    '',
    'Do not mention the context, the documents, your instructions, or these rules. Do not name the documents in your answer; the interface shows the reader what you used.',
    '',
    'CONTEXT.',
    '',
    // Only the parts that are actually known. A blank line saying "the reader's
    // name is not known" is a line the model can get creative about.
    ...(here
      ? [
          `The reader is looking at ${here.name}. Status: ${STAGE_LABEL[here.stage]}. Take "this", "it" and "here" to mean that tool unless they say otherwise.`,
        ]
      : ['The reader is not inside a particular tool. Do not assume which one they mean.']),
    ...(name ? [`Their first name is ${name}. Use it sparingly, if at all.`] : []),
    ...(role ? [`Their role on this platform is ${role}.`] : []),
    `Today, in Asia/Kolkata, is ${istToday()}. Prefer the tool over this line when a date matters.`,
  ].join('\n');
}

/**
 * The retrieved documents, as one block.
 *
 * Numbered and titled rather than run together, because the model has to be able
 * to tell one from another to know when it has been given nothing relevant. A
 * wall of undifferentiated text invites it to blend two documents into a claim
 * neither of them makes.
 */
export function contextBlock(hits: Hit[]): string {
  if (hits.length === 0) {
    return 'No documents matched this question. Say you do not know rather than answering from general knowledge about finance software.';
  }

  return hits
    .map((hit, i) => {
      const agent = hit.doc.agent ? AGENTS.find((a) => a.slug === hit.doc.agent) : undefined;
      const heading = agent ? `${hit.doc.title} (${agent.name})` : hit.doc.title;
      return `--- Document ${i + 1}: ${heading} ---\n${hit.doc.body}`;
    })
    .join('\n\n');
}

/** The same documents, as the chips shown under the answer. */
export function sourcesOf(hits: Hit[]): Source[] {
  return hits.map((hit) => ({
    id: hit.doc.id,
    title: hit.doc.title,
    agent: hit.doc.agent,
    href: hit.doc.href,
  }));
}

/**
 * The conversation, trimmed to what will be sent.
 *
 * Trimmed from the front, so the newest question is never the thing dropped, and
 * always ending on a user turn where possible. An assistant turn arriving last
 * would ask the model to continue its own answer rather than to respond.
 *
 * Both limits are here because they fail differently. The turn count keeps a
 * long chat from growing without bound; the character count catches the one turn
 * where somebody pasted a ledger in.
 */
export function trimHistory(turns: Ask['turns']): Ask['turns'] {
  let kept = turns.slice(-MAX_HISTORY_TURNS);

  let size = kept.reduce((n, t) => n + t.content.length, 0);
  while (kept.length > 1 && size > MAX_HISTORY_CHARS) {
    size -= kept[0].content.length;
    kept = kept.slice(1);
  }

  // Never open on an assistant turn: without its question in front of it, it
  // reads as something the model said unprompted.
  while (kept.length > 1 && kept[0].role === 'assistant') kept = kept.slice(1);

  return kept;
}

/** The question this turn is about, which is what retrieval runs on. */
export function latestQuestion(turns: Ask['turns']): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') return turns[i].content;
  }
  return '';
}

/**
 * Retrieval over the last question alone is wrong for a follow-up.
 *
 * "What about inter-state?" has no retrievable word in it, and on its own it
 * finds nothing. Prepending the previous question restores the subject without
 * pulling in the whole conversation, which would drown the current question in
 * whatever was being discussed five turns ago.
 */
export function retrievalQuery(turns: Ask['turns']): string {
  const questions = turns.filter((t) => t.role === 'user').map((t) => t.content);
  if (questions.length === 0) return '';

  const last = questions[questions.length - 1];
  const previous = questions[questions.length - 2];

  // A question that stands on its own does not need the help, and giving it
  // anyway drags the previous subject into the results.
  if (!previous || last.length > 80) return last;
  return `${previous}\n${last}`;
}
