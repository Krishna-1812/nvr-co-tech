import { describe, expect, it } from 'vitest';
import { buildInput } from './input';
import { neverCaptured } from './private-paths';

const VID = '123e4567-e89b-42d3-a456-426614174000';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';

describe('neverCaptured', () => {
  it('covers the will and everything under it, whatever the case or trailing slash', () => {
    for (const p of ['/will-maker', '/will-maker/', '/WILL-MAKER', '/will-maker/anything/deep', ' /will-maker ']) expect(neverCaptured(p), p).toBe(true);
  });

  it('leaves everything else alone, including look-alikes', () => {
    for (const p of ['/', '/contact', '/wealth-tracker', '/will-makers', '/will', '/tools/will-maker', '/will-maker-guide']) expect(neverCaptured(p), p).toBe(false);
  });
});

describe('what the server stores', () => {
  const events = (path: string) => ({
    type: 'events',
    vid: VID,
    events: [{ kind: 'field', path, label: 'Full name', value: 'Rohan Mehta' }],
  });

  it('keeps a field from an ordinary page', () => {
    expect(buildInput(events('/contact'), UA)).toMatchObject({ type: 'events', events: [{ value: 'Rohan Mehta' }] });
  });

  it('drops anything that claims to come from a will, so a stale or hand-made client cannot store it', () => {
    expect(buildInput(events('/will-maker'), UA)).toBeNull();
    expect(buildInput(events('/will-maker/anything'), UA)).toBeNull();
  });

  it('drops only the will’s events from a mixed batch', () => {
    const body = {
      type: 'events',
      vid: VID,
      events: [
        { kind: 'field', path: '/contact', label: 'Name', value: 'Asha' },
        { kind: 'field', path: '/will-maker', label: 'Full name', value: 'Rohan Mehta' },
        { kind: 'click', path: '/will-maker', label: 'Remove Nisha Mehta', value: null },
      ],
    };
    const out = buildInput(body, UA) as { events: { value: string }[] };
    expect(out.events.map((e) => e.value)).toEqual(['Asha']);
  });
});
