import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Everything public that mentions Will Maker (the roster, the open-tools list, the
 * sitemap, llms.txt, the assistant's knowledge, the privacy page) is derived from
 * `willMakerPublic()`. These tests load the real modules under each combination
 * and check that before launch there is nothing, and after it there is everything.
 */

const SIGNED = { by: 'A. Advocate, Enrolment MH/1/2020, Firm', on: '2026-12-01', packet: 'abc123' };

async function site(signOff: typeof SIGNED | null, env: string) {
  vi.resetModules();
  vi.doMock('@/lib/will/law', async (orig) => {
    const real = await orig<typeof import('@/lib/will/law')>();
    return { ...real, LAW: { ...real.LAW, advocateSignOff: signOff } };
  });
  vi.stubEnv('NEXT_PUBLIC_WILL_MAKER', env);
  const [content, access, sitemap, llms, knowledge, solutions] = await Promise.all([
    import('@/lib/marketing/content'),
    import('@/lib/access'),
    import('@/app/sitemap'),
    import('@/app/llms.txt/route'),
    import('@/lib/assist/knowledge'),
    import('@/lib/solutions'),
  ]);
  return { content, access, sitemap: sitemap.default(), llms: await llms.GET().text(), knowledge, solutions };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/will/law');
  vi.resetModules();
});

const mentions = (text: string) => /will[- ]maker/i.test(text);

describe('before launch', () => {
  for (const [label, signOff, env] of [
    ['no sign-off, no flag', null, ''],
    ['flag but no sign-off', null, '1'],
    ['sign-off but no flag', SIGNED, ''],
  ] as const) {
    it(`leaves Will Maker out of the whole public site (${label})`, async () => {
      const s = await site(signOff, env);
      expect(s.content.AGENTS.map((a) => a.slug)).not.toContain('will-maker');
      expect(s.access.OPEN_TOOLS).not.toContain('will-maker');
      expect(s.sitemap.map((e) => e.url).join('\n')).not.toMatch(/will-maker/);
      expect(mentions(s.llms)).toBe(false);
      // The roster everybody sees leaves it out; only the admins' hub card (WILL_SOLUTION) has it.
      expect(s.solutions.SOLUTIONS.map((x) => x.slug)).not.toContain('will-maker');
      expect(s.solutions.WILL_SOLUTION).toMatchObject({ slug: 'will-maker', stage: 'live', open: '/will-maker' });
      expect(s.knowledge.DOCS.some((d) => mentions(d.title) || mentions(d.body))).toBe(false);
    });
  }
});

describe('after launch (sign-off and flag)', () => {
  it('puts it on the roster, in the open tools, the sitemap, llms.txt and the assistant', async () => {
    const s = await site(SIGNED, '1');
    const wm = s.content.AGENTS.find((a) => a.slug === 'will-maker');
    expect(wm?.stage).toBe('live');
    expect(wm?.href).toBe('/will-maker');
    expect(s.access.OPEN_TOOLS).toContain('will-maker');
    expect(s.sitemap.map((e) => e.url)).toContain(new URL('/tools/will-maker', s.content.SITE_URL).toString());
    expect(s.llms).toContain('Will Maker');
    const doc = s.knowledge.DOCS.find((d) => d.id === 'agent-will-maker');
    expect(doc?.body).toContain('Do I need a notary?');
    expect(doc?.body).toContain('Indian Succession Act');
  });

  it('never publishes the tool page itself (/will-maker) in the sitemap: it is a working screen, not a page to index', async () => {
    const s = await site(SIGNED, '1');
    expect(s.sitemap.map((e) => new URL(e.url).pathname)).not.toContain('/will-maker');
  });
});
