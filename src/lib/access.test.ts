import { describe, expect, it } from 'vitest';
import { ADMIN_EMAILS, LOCKED_TOOLS, OPEN_TOOLS, canUseTool, isAdminEmail } from './access';
import { AGENTS } from './marketing/content';

describe('access', () => {
  it('knows the five admin addresses, whatever their case or spacing', () => {
    expect(ADMIN_EMAILS).toHaveLength(5);
    expect(isAdminEmail('Vivek.Gaggar@NVRandCo.com')).toBe(true);
    expect(isAdminEmail(' team@thefinanceintelligence.com ')).toBe(true);
    expect(isAdminEmail('vivek.gaggar@nvrandco.co')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it('opens two tools to everybody and the other four to admins only', () => {
    for (const slug of OPEN_TOOLS) {
      expect(canUseTool(slug, false)).toBe(true);
      expect(canUseTool(slug, true)).toBe(true);
    }
    for (const slug of LOCKED_TOOLS) {
      expect(canUseTool(slug, false)).toBe(false);
      expect(canUseTool(slug, true)).toBe(true);
    }
    expect(canUseTool('not-a-tool', true)).toBe(false);
  });

  it('opens a locked tool for one person when an admin has granted it, except Contact Finder', () => {
    expect(canUseTool('ledger-reconciliation', false, ['ledger-reconciliation'])).toBe(true);
    expect(canUseTool('voucher-desk', false, ['ledger-reconciliation'])).toBe(false);
    expect(canUseTool('contact-finder', false, ['contact-finder'])).toBe(false);
  });

  it('covers every live tool on the roster, once', () => {
    const live = AGENTS.filter((a) => a.stage === 'live').map((a) => a.slug).sort();
    expect([...OPEN_TOOLS, ...LOCKED_TOOLS].sort()).toEqual(live);
  });
});
