import { describe, expect, it } from 'vitest';
import { LIVE_AGENTS } from '@/lib/marketing/content';
import { retrieve } from './retrieve';
import { suggestionsFor } from './suggestions';

/**
 * The starter questions.
 *
 * Worth testing for one reason that is not obvious: a suggestion is a question
 * the interface asks on the reader's behalf, so a suggestion that retrieves
 * nothing produces an answer that says "I do not know" to a question the app
 * itself put in their mouth. That is a bad first impression and it is entirely
 * preventable here.
 */

describe('what is offered', () => {
  it('always offers four, whatever screen it is on', () => {
    expect(suggestionsFor(null)).toHaveLength(4);
    for (const agent of LIVE_AGENTS) {
      expect(suggestionsFor(agent.slug)).toHaveLength(4);
    }
  });

  it('leads with the tool on screen', () => {
    expect(suggestionsFor('ledger-reconciliation')[0].question).toMatch(/entries are the same/);
  });

  it('keeps "what can you do" wherever you are', () => {
    for (const agent of [null, ...LIVE_AGENTS.map((a) => a.slug)]) {
      expect(suggestionsFor(agent).some((s) => s.label === 'What can you do?')).toBe(true);
    }
  });

  it('offers the general set on a screen that is not a tool', () => {
    expect(suggestionsFor(null).map((s) => s.label)).toContain('Which tools are live?');
  });

  it('falls back to the general set for a tool with nothing written for it', () => {
    expect(suggestionsFor('gst-reconciliation')).toEqual(suggestionsFor(null));
  });

  it('gives the same four every time, so nobody has to read them twice', () => {
    expect(suggestionsFor('voucher-desk')).toEqual(suggestionsFor('voucher-desk'));
  });
});

describe('every suggestion can actually be answered', () => {
  it('retrieves something for each one', () => {
    // A suggested question that finds no documents produces "I do not know" to a
    // question the interface asked on the reader's behalf.
    for (const agent of [null, ...LIVE_AGENTS.map((a) => a.slug)]) {
      for (const suggestion of suggestionsFor(agent)) {
        const hits = retrieve(suggestion.question, { agent });
        expect(hits.length, `nothing found for "${suggestion.label}"`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the label short enough for a card', () => {
    for (const agent of [null, ...LIVE_AGENTS.map((a) => a.slug)]) {
      for (const suggestion of suggestionsFor(agent)) {
        expect(suggestion.label.length).toBeLessThanOrEqual(32);
      }
    }
  });
});
