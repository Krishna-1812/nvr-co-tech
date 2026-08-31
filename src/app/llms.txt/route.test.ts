import { describe, expect, it } from 'vitest';
import { AGENTS, BRAND, CONTACT, STAGE_LABEL } from '@/lib/marketing/content';
import { SITE_URL } from '@/lib/marketing/content';
import { GET } from './route';

const read = async () => {
  const res = GET();
  return { res, body: await res.text() };
};

/**
 * The file exists so that an assistant asked about this company answers from
 * something we wrote rather than from whatever it could scrape out of an
 * animated marketing page. Two properties matter, and neither is cosmetic.
 */
describe('/llms.txt', () => {
  it('is served as plain text', async () => {
    const { res } = await read();
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('names every agent on the roster', async () => {
    // The whole point of generating it. An agent added to content.ts and not
    // mentioned here is an agent no assistant will ever tell anybody about.
    const { body } = await read();
    for (const agent of AGENTS) {
      expect(body, `${agent.name} is missing`).toContain(agent.name);
      expect(body, `${agent.slug} has no link`).toContain(`${SITE_URL}/agents/${agent.slug}`);
    }
  });

  it('says of every agent whether it is built', async () => {
    /*
     * The one claim in this file that can do real damage. Six of the eight are
     * not built; an assistant that reads a confident summary with no stage on
     * it will tell somebody they can go and use Audit Copilot today, and that
     * misdirection came from us.
     */
    const { body } = await read();
    for (const agent of AGENTS) {
      const line = body.split('\n').find((l) => l.includes(`[${agent.name}]`));
      expect(line, `no line for ${agent.name}`).toBeDefined();
      expect(line).toContain(STAGE_LABEL[agent.stage]);
    }
  });

  it('opens with the brand and its one-line summary, as the format expects', async () => {
    const { body } = await read();
    const [heading, blank, summary] = body.split('\n');
    expect(heading).toBe(`# ${BRAND.name}`);
    expect(blank).toBe('');
    expect(summary).toBe(`> ${BRAND.blurb}`);
  });

  it('gives a way to reach a person', async () => {
    const { body } = await read();
    expect(body).toContain(CONTACT.email);
  });

  it('links only to absolute URLs', async () => {
    // A relative link in a file read outside a browser resolves against
    // nothing.
    const { body } = await read();
    const links = [...body.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(AGENTS.length);
    for (const href of links) expect(href).toMatch(/^https:\/\//);
  });
});
