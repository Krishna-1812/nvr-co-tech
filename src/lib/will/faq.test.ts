import { describe, expect, it } from 'vitest';
import { FAQ } from './faq';
import { GUIDE, NOT_NEEDED } from './guide';
import { CITE } from './law';

describe('the public questions and answers', () => {
  it('has the questions people ask first, each with a real answer', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8);
    for (const f of FAQ) {
      expect(f.q.endsWith('?')).toBe(true);
      expect(f.a.length).toBeGreaterThan(30);
    }
    expect(new Set(FAQ.map((f) => f.q)).size).toBe(FAQ.length);
  });

  it('takes its legal sentences from the signing guide, so the two cannot differ', () => {
    const answer = (start: string) => FAQ.find((f) => f.q.startsWith(start))!.a;
    const guideDetail = (start: string) => GUIDE.flatMap((p) => p.steps).find((s) => s.text.startsWith(start))!.detail!;
    expect(answer('Do I have to register')).toContain(guideDetail('Consider registering'));
    expect(answer('Who can be my witness')).toContain(guideDetail('Choose'));
    expect(answer('Who can be my witness')).toContain(guideDetail('Each witness'));
    expect(answer('What if my life changes')).toBe(guideDetail('Make a new will'));
    for (const n of NOT_NEEDED) expect(FAQ.map((f) => f.a).join('\n')).toContain(n.split('. ').slice(1).join('. '));
  });

  it('cites the section behind the claims it makes about validity, witnesses and e-signing', () => {
    const all = FAQ.map((f) => f.a).join('\n');
    for (const c of [CITE.signing, CITE.witnesses, CITE.witnessGift, CITE.registration, CITE.noEsign, CITE.muslims]) expect(all).toContain(c);
  });

  it('says nothing we have not verified: no probate, no nominee-versus-will, no promise about a court', () => {
    const all = FAQ.map((f) => `${f.q} ${f.a}`).join('\n');
    expect(all).not.toMatch(/probate|s\.213|section 213|nominee|court will|guarantee/i);
  });

  it('follows the site’s house style: no em-dashes', () => {
    for (const f of FAQ) expect(`${f.q}${f.a}`).not.toContain('—');
  });
});
