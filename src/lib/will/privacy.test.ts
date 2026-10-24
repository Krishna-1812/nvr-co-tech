import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * A will, and the list of what somebody owns, is the most sensitive thing the
 * site is asked to hold, and the product tells people it is kept in their
 * browser, not counted in statistics and never read by us. These tests read the
 * source and fail the build if code in the will's folders could break that:
 * by sending anything anywhere, logging it, or being wired to the analytics.
 *
 * They are blunt on purpose. A legitimate new use is added to an allowlist
 * here, in review, rather than slipping in.
 */

const ROOT = process.cwd();
const DIRS = ['src/lib/will', 'src/components/will', 'src/app/(will)'];

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

const SOURCES = DIRS.flatMap(files).map((p) => ({ path: p, text: readFileSync(join(ROOT, p), 'utf8') }));

/** Strips comments so a sentence in a doc comment cannot trip (or hide) a rule. */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const hits = (re: RegExp) => SOURCES.filter((s) => re.test(code(s.text))).map((s) => s.path);

describe('the will never reaches the analytics, the logs or the network on its own', () => {
  it('has source to check', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it('does not import or call the analytics capture or tracker', () => {
    expect(hits(/captureTool|lib\/analytics|analytics\/capture|startCapture|\/api\/track/)).toEqual([]);
  });

  it('does not log, and does not report errors with its state', () => {
    expect(hits(/\bconsole\.|logServerError|lib\/errors/)).toEqual([]);
  });

  it('makes no network calls of its own', () => {
    expect(hits(/\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|EventSource|navigator\.share/)).toEqual([]);
  });

  it('reaches the server only through the two server actions it is allowed', () => {
    const allowed: Record<string, string> = {
      'src/lib/will/account.ts': "@/app/actions/saves",
      'src/components/will/HelpRequest.tsx': "@/app/actions/access",
    };
    const found = SOURCES.flatMap((s) => [...s.text.matchAll(/from\s+['"]@\/app\/actions\/([a-z]+)['"]/g)].map((m) => [s.path, `@/app/actions/${m[1]}`]));
    expect(Object.fromEntries(found)).toEqual(allowed);
  });

  it('keeps browser storage to the store and the help form’s “already asked” note', () => {
    expect(hits(/\blocalStorage\b|\bsessionStorage\b|indexedDB/).sort()).toEqual(['src/components/will/HelpRequest.tsx', 'src/lib/will/store.ts']);
  });

  it('does not mark the help form as a lead form, which the site tracker watches', () => {
    expect(hits(/data-lead-form/)).toEqual([]);
  });

  it('does not put a will in a URL, a title or a cookie', () => {
    expect(hits(/document\.cookie|location\.(search|hash)|history\.(pushState|replaceState)|searchParams|useSearchParams/)).toEqual([]);
  });
});

describe('the page itself', () => {
  const workbench = SOURCES.find((s) => s.path.endsWith('WillWorkbench.tsx'))!.text;

  it('fences its own markup from the site’s field capture', () => {
    expect(workbench).toMatch(/data-private/);
  });

  it('is not indexed, and is disallowed to crawlers', () => {
    expect(SOURCES.find((s) => s.path.endsWith('will-maker/page.tsx'))!.text).toMatch(/index:\s*false/);
    expect(readFileSync(join(ROOT, 'src/app/robots.ts'), 'utf8')).toContain("'/will-maker'");
  });
});
