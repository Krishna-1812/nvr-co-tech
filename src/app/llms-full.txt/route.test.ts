import { describe, expect, it } from 'vitest';
import { AGENTS, CANONICAL_URL, STAGE_LABEL } from '@/lib/marketing/content';
import { GET } from './route';

const body = () => GET().text();

describe('/llms-full.txt', () => {
  it('is served as plain text', () => {
    expect(GET().headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('gives every tool a heading that says whether it is built, and a link', async () => {
    const text = await body();
    for (const a of AGENTS) {
      expect(text).toContain(`## ${a.name} (${STAGE_LABEL[a.stage]})`);
      expect(text).toContain(`${CANONICAL_URL}/tools/${a.slug}`);
    }
  });

  it('carries every question and answer on the tool pages, word for word', async () => {
    const text = await body();
    for (const a of AGENTS) for (const f of a.faq ?? []) {
      expect(text).toContain(`Q: ${f.q}`);
      expect(text).toContain(`A: ${f.a}`);
    }
  });

  it('never lists what an unbuilt tool will do as something it does', async () => {
    const text = await body();
    for (const a of AGENTS.filter((x) => x.stage !== 'live')) {
      const start = text.indexOf(`## ${a.name} (`);
      const chunk = text.slice(start, text.indexOf('\n## ', start + 1) === -1 ? undefined : text.indexOf('\n## ', start + 1));
      expect(chunk).toContain('What it is planned to do (not built yet):');
    }
  });
});
