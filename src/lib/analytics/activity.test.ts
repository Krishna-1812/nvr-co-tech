import { describe, expect, it } from 'vitest';
import type { SiteChatRow, SiteEventRow, SiteToolDataRow, SiteVisitorRow } from '@/lib/supabase/types';
import { buildActivity } from './activity';

const visitor = (id: string, user_id: string | null = null): SiteVisitorRow =>
  ({ id, user_id, email: null, first_seen: '2026-10-01T00:00:00Z', last_seen: '2026-10-29T00:00:00Z' }) as SiteVisitorRow;

const chat = (over: Partial<SiteChatRow>): SiteChatRow => ({
  id: crypto.randomUUID(),
  visitor_id: 'v1',
  user_id: null,
  session_id: 's1',
  conversation: 'c1',
  mode: 'visitor',
  path: '/',
  via: 'typed',
  question: 'What is loading?',
  answer: 'The share of common areas.',
  sources: [],
  tools: [],
  outcome: 'answered',
  error: null,
  model: 'm',
  first_ms: 400,
  total_ms: 2000,
  at: '2026-10-28T10:00:00Z',
  ...over,
});

describe('activity', () => {
  it('puts a browser that later signed in under the account, earlier chats and all', () => {
    const a = buildActivity({
      // v1 has since signed in as u1; v2 never has.
      visitors: [visitor('v1', 'u1'), visitor('v2')],
      accounts: [{ id: 'u1', email: 'asha@example.com', full_name: 'Asha Rao', created_at: '2026-10-28T12:00:00Z', last_sign_in_at: null, provider: 'email' }],
      chats: [
        chat({ at: '2026-10-28T10:00:00Z' }),
        chat({ at: '2026-10-28T10:01:00Z', question: 'And for a villa?' }),
        chat({ visitor_id: 'v2', conversation: 'c9', at: '2026-10-28T11:00:00Z', outcome: 'limited', answer: null }),
      ],
      events: [],
      tools: [],
    });
    expect(a.threads).toHaveLength(2);
    const asha = a.threads.find((t) => t.who.key === 'u:u1')!;
    expect(asha.who).toMatchObject({ kind: 'account', name: 'Asha Rao', email: 'asha@example.com' });
    expect(asha.turns.map((t) => t.question)).toEqual(['What is loading?', 'And for a villa?']);
    expect(a.byPerson['u:u1'].questions).toBe(2);
    expect(a.byPerson['v:v2'].questions).toBe(1);
    expect(a.totals).toEqual({ questions: 3, threads: 2, unanswered: 1, askers: 2 });
  });

  it('keeps separate chats apart, and newest first', () => {
    const a = buildActivity({
      visitors: [visitor('v1')],
      accounts: [],
      chats: [chat({ conversation: 'c1', at: '2026-10-27T10:00:00Z' }), chat({ conversation: 'c2', at: '2026-10-28T10:00:00Z' })],
      events: [],
      tools: [],
    });
    expect(a.threads.map((t) => t.key)).toEqual(['v:v1|c2', 'v:v1|c1']);
  });

  it('adds fields, clicks and tool work to the same person’s timeline, newest first', () => {
    const events: SiteEventRow[] = [
      { id: 1, visitor_id: 'v1', user_id: null, session_id: 's', path: '/contact', kind: 'field', label: 'Company', value: 'Rao & Co', at: '2026-10-28T09:00:00Z' },
      { id: 2, visitor_id: 'v1', user_id: null, session_id: 's', path: '/contact', kind: 'click', label: 'Send', value: null, at: '2026-10-28T09:01:00Z' },
    ];
    const tools: SiteToolDataRow[] = [
      { visitor_id: 'v1', tool: 'true-property-cost', user_id: null, body: '{}', sealed: false, first_at: '2026-10-28T08:00:00Z', updated_at: '2026-10-28T08:30:00Z', saves: 7 },
    ];
    const a = buildActivity({ visitors: [visitor('v1')], accounts: [], chats: [chat({})], events, tools });
    const p = a.byPerson['v:v1'];
    expect(p).toMatchObject({ questions: 1, fields: 1, clicks: 1 });
    expect(p.tools).toEqual([{ tool: 'true-property-cost', first: '2026-10-28T08:00:00Z', last: '2026-10-28T08:30:00Z', saves: 7, sealed: false }]);
    expect(p.moments.map((m) => m.t)).toEqual(['chat', 'click', 'field', 'tool', 'tool']);
  });
});
