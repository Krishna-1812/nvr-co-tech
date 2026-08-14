import { describe, expect, it } from 'vitest';
import { AGENTS, LIVE_AGENTS, STAGE_LABEL } from '@/lib/marketing/content';
import { ROLE_META, USER_ROLES } from '@/lib/domain/workflow';
import { reconSection, voucherSection } from '@/lib/nav';
import { DOCS, docById } from './knowledge';

/**
 * The corpus.
 *
 * This is the only thing standing between a question about the platform and a
 * confident invention, so what is tested is not its prose but its invariants:
 * that it covers every tool, that it says the same thing about each tool as the
 * website does, and that it cannot describe something that is not built as
 * though it were.
 *
 * The house-style checks at the bottom look fussy for a file of strings. They
 * are not. Every word here can end up on a customer's screen, in an answer that
 * carries the firm's name.
 */

describe('the shape of it', () => {
  it('gives every document a unique id', () => {
    expect(new Set(DOCS.map((d) => d.id)).size).toBe(DOCS.length);
  });

  it('gives every document a title and something to say', () => {
    for (const doc of DOCS) {
      expect(doc.title.length).toBeGreaterThan(3);
      expect(doc.body.length).toBeGreaterThan(120);
    }
  });

  it('only ever points a document at a tool that exists', () => {
    const slugs = new Set(AGENTS.map((a) => a.slug));
    for (const doc of DOCS) {
      if (doc.agent) expect(slugs).toContain(doc.agent);
    }
  });

  it('finds a document by id', () => {
    expect(docById('voucher-workflow')?.agent).toBe('voucher-desk');
    expect(docById('nothing-like-this')).toBeUndefined();
  });
});

describe('agreeing with the website', () => {
  it('has a document for every tool on the roster', () => {
    for (const agent of AGENTS) {
      expect(docById(`agent-${agent.slug}`)).toBeTruthy();
    }
  });

  it("carries each tool's promises verbatim rather than paraphrasing them", () => {
    // The roster is where a tool's promise is written down. A second wording
    // here is a second thing to keep in step, and it would not be kept in step.
    for (const agent of AGENTS) {
      const doc = docById(`agent-${agent.slug}`);
      expect(doc?.body).toContain(agent.summary);
      expect(doc?.body).toContain(agent.pitch);
      for (const line of agent.does) expect(doc?.body).toContain(line);
    }
  });

  it('states the stage of every tool', () => {
    for (const agent of AGENTS) {
      expect(docById(`agent-${agent.slug}`)?.body).toContain(
        `Status: ${STAGE_LABEL[agent.stage]}.`,
      );
    }
  });

  it('says of a roadmap tool that nobody can switch it on', () => {
    for (const agent of AGENTS.filter((a) => a.stage !== 'live')) {
      expect(docById(`agent-${agent.slug}`)?.body).toMatch(/It is not built yet/);
    }
  });

  it('says of a live tool where it opens', () => {
    for (const agent of LIVE_AGENTS) {
      expect(docById(`agent-${agent.slug}`)?.body).toContain(String(agent.href));
    }
  });

  it('takes every route from the navigation rather than writing them down again', () => {
    /*
     * Added after the live model sent somebody to /dashboard for their approval
     * queue. It had nothing else to go on, so the one part of the answer it had
     * to invent was the part the reader would act on.
     */
    const screens = docById('platform-screens')?.body ?? '';
    for (const item of voucherSection({ role: 'owner' }).items) {
      expect(screens, `${item.href} is missing`).toContain(item.href);
    }
    for (const item of reconSection().items) {
      expect(screens, `${item.href} is missing`).toContain(item.href);
    }
    expect(screens).toContain('/hub');
  });

  it('takes the role ladder from the same table the settings screen prints', () => {
    const roles = docById('platform-roles');
    for (const role of USER_ROLES) {
      expect(roles?.body).toContain(ROLE_META[role].grants);
    }
  });
});

describe('being careful about statutory figures', () => {
  it('tells the reader to confirm the rate rather than trusting the table', () => {
    const tds = docById('finance-tds');
    expect(tds?.body).toMatch(/Always confirm the current position/);
    expect(tds?.body).toMatch(/not a complete list of sections/);
  });

  it('says the GST rules change', () => {
    expect(docById('finance-gst')?.body).toMatch(/confirm the current position/);
  });

  it('marks the monthly dates as being for a monthly filer', () => {
    expect(docById('finance-month')?.body).toMatch(/monthly filer/);
    expect(docById('finance-month')?.body).toMatch(/Check your own due dates/);
  });
});

describe('being honest about the assistant itself', () => {
  it('says what it cannot do, in the words somebody would ask in', () => {
    const limits = docById('assistant-limits')?.body ?? '';
    for (const verb of ['raise a voucher', 'approve one', 'run a reconciliation']) {
      expect(limits).toContain(verb);
    }
    expect(limits).toMatch(/It cannot see your records/);
    expect(limits).toMatch(/not a substitute for professional advice/);
  });

  it('warns that questions are sent to a third party', () => {
    expect(docById('platform-privacy')?.body).toMatch(/sent to Anthropic/);
  });
});

describe('house style, because a customer reads all of this', () => {
  it('has no em-dashes anywhere in a body', () => {
    for (const doc of DOCS) {
      expect(doc.body, `${doc.id} has an em-dash`).not.toMatch(/—/);
    }
  });

  it('has no em-dashes in a title', () => {
    for (const doc of DOCS) expect(doc.title).not.toMatch(/—/);
  });

  it('does not leave a line long enough to read as a wall', () => {
    /*
     * The hand-written documents are set as fixed-width paragraphs, and a stray
     * very long line in one of them means a paragraph was pasted in rather than
     * written. The generated ones carry sentences from the roster and the job
     * calendar at whatever length those were written at, which is not this
     * file's business to reformat.
     */
    const generated = (id: string) =>
      id.startsWith('agent-') || id === 'finance-month' || id === 'platform-screens';

    for (const doc of DOCS) {
      if (generated(doc.id)) continue;
      for (const line of doc.body.split('\n')) {
        expect(line.length, `${doc.id}: ${line}`).toBeLessThan(110);
      }
    }
  });
});
