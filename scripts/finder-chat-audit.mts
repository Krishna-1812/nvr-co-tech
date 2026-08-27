/**
 * A live, end-to-end audit of the chat: real Apollo, real Anthropic, a stub
 * Supabase (so nothing is written to a real database — every read comes back
 * empty, every learned-vocab lookup is a miss, every history write is a no-op).
 *
 *     APOLLO_API_KEY=... ANTHROPIC_API_KEY=... ANTHROPIC_BASE_URL=https://api.anthropic.com/v1 \
 *       npx vite-node --config vitest.config.mts scripts/finder-chat-audit.mts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';
import { runChat, type ChatRequest } from '../src/lib/finder/chat/run';

const apolloKey = process.env.APOLLO_API_KEY;
if (!apolloKey) {
  console.error('Set APOLLO_API_KEY.');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY.');
  process.exit(1);
}

function fakeSupabase(): SupabaseClient<Database> {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'gt', 'eq', 'order', 'limit']) builder[method] = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return {
    from: () => builder,
    rpc: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient<Database>;
}

const QUESTIONS: ChatRequest[] = [
  { message: 'who is the CMO of Snowflake', history: [] },
  { message: 'CMO of Thoughtworks', history: [] },
  { message: 'who all are in the senior marketing team of boAt', history: [] },
  { message: 'list VPs of Sales at healthcare companies in Texas', history: [] },
  { message: 'is there a CFO at a company called asdkfjhaslkdjfh-not-real', history: [] },
  { message: 'tell me about Notion the software company', history: [] },
  { message: 'find me some good leads', history: [] },
];

async function main() {
  const supabase = fakeSupabase();
  for (const req of QUESTIONS) {
    console.log(`\n─── "${req.message}" ───`);
    try {
      const reply = await runChat(supabase, apolloKey!, req);
      console.log('answer:', reply.answer);
      if (reply.choices) console.log('choices:', JSON.stringify(reply.choices));
      if (reply.context) console.log('context:', JSON.stringify(reply.context));
      if (reply.enrich?.length) console.log('enrich chips:', reply.enrich.length);
      console.log('credits spent:', reply.credits ?? 0, '| researched:', reply.researched ?? false, '| web_search:', reply.web_search ?? false);
    } catch (e) {
      console.log('THREW:', e instanceof Error ? e.stack ?? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
