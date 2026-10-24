import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REVIEWED_FILES } from './review';

/**
 * The digest of the files an advocate approves, for the review packet and for
 * the build's check that a sign-off still matches them. Node only (tests and the
 * packet script); never imported by the app.
 *
 * Line endings are normalised so a checkout on Windows hashes the same as one
 * on Linux. Any other change, including a comment, changes the digest: the
 * comments in these files are part of what is reviewed.
 */
export function reviewDigest(root: string = process.cwd()): string {
  const h = createHash('sha256');
  for (const f of REVIEWED_FILES) {
    h.update(`${f}\n`);
    h.update(readFileSync(join(root, f), 'utf8').replace(/\r\n/g, '\n'));
    h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}
