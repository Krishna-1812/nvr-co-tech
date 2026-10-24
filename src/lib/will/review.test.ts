import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAW } from './law';
import { buildReviewPacket, REVIEWED_FILES, reviewedCheckIds, reviewedPromptIds } from './review';
import { reviewDigest } from './review-digest';

/*
 * The controls that stop the legal sign-off from going stale: the packet an
 * advocate reads is the current code, any sign-off matches the code it was
 * given, and the packet leaves nothing out.
 */

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');

/** Every id a source file can raise: `id: 'x'` and `id: `x:${…}``, prefix before any colon. */
function idsIn(file: string): string[] {
  const ids = new Set<string>();
  for (const m of read(file).matchAll(/\bid:\s*[`'"]([a-z][a-z0-9-]*)/g)) ids.add(m[1]);
  return [...ids];
}

describe('the legal review packet', () => {
  it('is the current code: regenerate it with `npm run will:packet` if this fails', () => {
    const committed = readFileSync(join(process.cwd(), 'docs/will-maker/legal-review.md'), 'utf8');
    expect(committed).toBe(buildReviewPacket(reviewDigest()));
  });

  it('is deterministic', () => {
    expect(buildReviewPacket('x')).toBe(buildReviewPacket('x'));
  });

  it('prints the digest it was made for, every reviewed file, and the sign-off block', () => {
    const p = buildReviewPacket('deadbeef');
    expect(p).toContain('`deadbeef`');
    for (const f of REVIEWED_FILES) expect(p).toContain(`\`${f}\``);
    expect(p).toContain('## 11. Sign-off');
  });

  it('puts every question for the advocate in front of them, and every religion and circumstance', () => {
    const p = buildReviewPacket('x');
    expect(p).toContain('Muslim');
    expect(p).toContain('State: Goa');
    expect(p).toContain('Under 18');
    expect(p).toContain('**Probate.**');
    expect(p).toContain('**Electronic signatures.**');
  });
});

describe('coverage: nothing the code can say is missing from the packet', () => {
  it('lists every check in checks.ts', () => {
    // Scope ids are built from law.ts (`scope-${reason.id}`) and are covered by §4.
    const raised = idsIn('src/lib/will/checks.ts').filter((id) => id !== 'scope-');
    const covered = new Set(reviewedCheckIds());
    const missing = raised.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it('lists every after-signing prompt in register.ts', () => {
    const raised = idsIn('src/lib/will/register.ts').filter((id) => id !== 'member');
    const covered = new Set([...reviewedPromptIds(), 'member', 'nominee-drift']);
    expect(raised.filter((id) => !covered.has(id))).toEqual([]);
    expect(reviewedPromptIds()).toEqual(expect.arrayContaining(['wealth-new', 'wealth-gone', 'member', 'nominee-drift']));
  });
});

describe('the sign-off', () => {
  it('matches the files it was given, or there is none', () => {
    const s = LAW.advocateSignOff;
    if (s === null) return; // Nobody has signed off yet: the tool stays admin-only (flag.test).
    expect(s.by.trim().length).toBeGreaterThan(5);
    expect(s.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // If this fails, a reviewed file changed after the advocate signed. Regenerate the packet,
    // send them the change, and update `packet` only from their new written sign-off.
    expect(s.packet, 'A reviewed file changed after the sign-off: the sign-off no longer applies').toBe(reviewDigest());
  });
});

describe('reviewDigest', () => {
  const make = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'digest-'));
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(join(root, f, '..'), { recursive: true });
      writeFileSync(join(root, f), text);
    }
    return root;
  };
  const files = () => Object.fromEntries(REVIEWED_FILES.map((f) => [f, `// ${f}\nexport const x = 1;\n`]));

  it('is the same for the same files and for CRLF checkouts, and changes when any one file does', () => {
    const base = reviewDigest(make(files()));
    expect(reviewDigest(make(files()))).toBe(base);
    const crlf = Object.fromEntries(Object.entries(files()).map(([f, t]) => [f, t.replace(/\n/g, '\r\n')]));
    expect(reviewDigest(make(crlf))).toBe(base);
    for (const f of REVIEWED_FILES) {
      expect(reviewDigest(make({ ...files(), [f]: files()[f] + '// a changed comment\n' })), f).not.toBe(base);
    }
  });

  it('is 16 hex characters', () => {
    expect(reviewDigest()).toMatch(/^[0-9a-f]{16}$/);
  });
});
