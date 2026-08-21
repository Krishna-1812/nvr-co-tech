import { describe, expect, it } from 'vitest';
import { deskBrief, type DeskCounts } from './desk';

const counts = (over: Partial<DeskCounts> = {}): DeskCounts => ({
  sentBack: 0,
  queue: 0,
  drafts: 0,
  withApprovers: 0,
  everRaised: 5,
  ...over,
});

/** Every state, so a rule can be asserted across all of them at once. */
const EVERY_STATE: Partial<DeskCounts>[] = [
  { sentBack: 1 },
  { sentBack: 3 },
  { queue: 1 },
  { queue: 4, oldestQueueDays: 6 },
  { drafts: 1 },
  { drafts: 2 },
  { withApprovers: 1 },
  { withApprovers: 5 },
  { everRaised: 0 },
  {},
];

describe('deskBrief', () => {
  it('leads on what came back, above everything else', () => {
    const brief = deskBrief(counts({ sentBack: 2, queue: 9, drafts: 4, withApprovers: 3 }));
    expect(brief.headline).toBe('2 vouchers came back.');
    expect(brief.cta.href).toBe('/vouchers?status=rejected');
  });

  it('puts the queue above your own drafts, because other people are held up', () => {
    expect(deskBrief(counts({ queue: 3, drafts: 4 })).cta.href).toBe('/approvals');
  });

  /*
   * The bug this module exists to make impossible. The dashboard used to check
   * "with approvers" before "drafts", so an approver holding two of their own
   * unfinished drafts was told nothing was waiting on them.
   */
  it('puts your drafts above vouchers you cannot move', () => {
    const brief = deskBrief(counts({ drafts: 2, withApprovers: 6 }));
    expect(brief.headline).toBe('2 drafts still to finish.');
    expect(brief.cta.href).toBe('/vouchers?status=draft');
  });

  it('names the wait only once the head of the queue has aged', () => {
    expect(deskBrief(counts({ queue: 1, oldestQueueDays: 1 })).detail).not.toMatch(/days/);
    expect(deskBrief(counts({ queue: 1, oldestQueueDays: 4 })).detail).toMatch(/4 days/);
  });

  it('agrees with itself about singulars', () => {
    const one = deskBrief(counts({ queue: 1 }));
    expect(one.headline).toBe('1 voucher needs your approval.');
    expect(one.note).toMatch(/1 voucher is waiting/);
    expect(deskBrief(counts({ sentBack: 1 })).detail).toMatch(/clear it for you/);
    expect(deskBrief(counts({ sentBack: 2 })).detail).toMatch(/clear them for you/);
  });

  it('tells a workspace nobody has used from a quiet one', () => {
    expect(deskBrief(counts({ everRaised: 0 })).headline).toBe('Nothing raised yet.');
    expect(deskBrief(counts({ everRaised: 12 })).headline).toBe('The desk is clear.');
  });

  /*
   * The first thing the product says about itself must not be the one thing it
   * stopped doing. Voucher numbers have been typed by hand since 0019.
   */
  it('never claims the voucher number writes itself', () => {
    const first = deskBrief(counts({ everRaised: 0 }));
    expect(first.note).toMatch(/suggested/);
    expect(first.note).not.toMatch(/writes itself|automatic|assigned/i);
  });

  it('does not offer the queue as the action when nothing is in it', () => {
    for (const over of [{ drafts: 1 }, { withApprovers: 1 }, { everRaised: 0 }, {}]) {
      expect(deskBrief(counts(over)).cta.href).not.toBe('/approvals');
    }
  });

  /*
   * The dashboard shows the headline and the detail together, one under the
   * other. The first version of this module used one string for both, so it read
   * "1 voucher came back." and then "1 voucher came back for correction".
   */
  it('never lets the detail restate its own headline', () => {
    const opening = (s: string) => s.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
    for (const over of EVERY_STATE) {
      const brief = deskBrief(counts(over));
      expect(opening(brief.detail), JSON.stringify(over)).not.toBe(opening(brief.headline));
    }
  });

  /*
   * The workspace card renders the note with no headline above it, so a note
   * that opens on a bare pronoun leaves the reader with no referent.
   */
  it('gives the workspace card a line that stands on its own', () => {
    for (const over of EVERY_STATE) {
      const note = deskBrief(counts(over)).note;
      expect(note, JSON.stringify(over)).not.toMatch(/^(it|them|those|that|they)\b/i);
      // Long enough to be a sentence, and it has to end like one.
      expect(note.length, JSON.stringify(over)).toBeGreaterThan(20);
      expect(note.endsWith('.'), note).toBe(true);
    }
  });

  it('ends every headline as a sentence', () => {
    for (const over of EVERY_STATE) {
      expect(deskBrief(counts(over)).headline.endsWith('.')).toBe(true);
    }
  });

  it('gives every state a status colour rather than a literal', () => {
    for (const over of EVERY_STATE) {
      expect(deskBrief(counts(over)).tone).toMatch(/^var\(--status-/);
    }
  });
});
