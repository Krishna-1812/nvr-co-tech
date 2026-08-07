import type { Hit } from './retrieve';
import type { AssistEvent } from './types';

/**
 * An answer with no model behind it.
 *
 * This exists for one reason: preview mode. The app is built to run entirely on
 * fixtures with no database, so that every screen can be looked at before
 * Supabase exists, and a chat window that can only ever show a spinner would be
 * the one screen that broke that promise. There is also a duller reason. The
 * whole pipeline from the composer through the route to the stream parser and
 * the markdown renderer can be exercised end to end without spending a paisa,
 * which is how the interface was actually built.
 *
 * It is not a fallback and it is not a smaller model. It reads back the
 * documents retrieval found, and it says so at the top in the first line the
 * reader sees. Passing this off as an answer would be worse than showing an
 * error, because an error is at least honest about having failed.
 *
 * It can only ever run in preview mode, which cannot be enabled on a deployed
 * instance: see src/lib/preview. The route checks that separately, so this
 * module being importable is not the thing keeping it out of production.
 */

/**
 * Roughly a word at a time, so it arrives the way a real answer does.
 *
 * Cosmetic, and worth it: streaming is what the interface is built around, and a
 * sample that lands in one lump would not exercise the part most likely to be
 * wrong. Splitting after the space keeps the space with the word before it, so
 * the reassembled text is exactly the input.
 */
export function chunk(text: string, size = 4): string[] {
  const words = text.split(/(?<=\s)/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(''));
  return out;
}

function answer(question: string, hits: Hit[]): string {
  const asked = question.trim().replace(/\s+/g, ' ').slice(0, 120);

  if (hits.length === 0) {
    return [
      '**This is a sample answer. There is no model behind it.**',
      '',
      `Nothing in the knowledge base matched “${asked}”, so a real answer would say it does not know rather than guess.`,
      '',
      'Set `GEMINI_API_KEY` and turn preview mode off to ask the model itself.',
    ].join('\n');
  }

  return [
    '**This is a sample answer. There is no model behind it.**',
    '',
    `Preview mode is on and no Gemini key is set, so instead of an answer to “${asked}”, here is what the assistant would have been given to work from. A real answer would be written from these, in prose, with any figures coming from the calculators.`,
    '',
    ...hits.flatMap((hit) => [
      `### ${hit.doc.title}`,
      '',
      // Enough to read and judge the retrieval by, without reprinting a whole
      // document into the chat window.
      `${hit.doc.body.split('\n').filter(Boolean).slice(0, 6).join(' ')}`,
      '',
    ]),
    '---',
    '',
    'Set `GEMINI_API_KEY` and turn preview mode off to ask the model itself.',
  ].join('\n');
}

/** The same event stream the real one produces, so nothing downstream branches. */
export async function* runOffline(question: string, hits: Hit[]): AsyncGenerator<AssistEvent> {
  // First, before a word of it. The text says what it is as well, but the label
  // is what somebody skimming will see.
  yield { type: 'note', note: 'offline' };

  for (const text of chunk(answer(question, hits))) {
    yield { type: 'delta', text };
  }
  yield { type: 'done' };
}
