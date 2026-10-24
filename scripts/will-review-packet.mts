// Regenerates docs/will-maker/legal-review.md from the code. Run after changing
// anything in the reviewed files (src/lib/will/review.ts REVIEWED_FILES); a test
// fails while the committed packet is stale.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReviewPacket } from '../src/lib/will/review';
import { reviewDigest } from '../src/lib/will/review-digest';

const digest = reviewDigest();
writeFileSync(join(process.cwd(), 'docs', 'will-maker', 'legal-review.md'), buildReviewPacket(digest));
console.log(`wrote docs/will-maker/legal-review.md (digest ${digest})`);
