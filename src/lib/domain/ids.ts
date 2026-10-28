import { z } from 'zod';
import { PREVIEW } from '@/lib/preview';

/**
 * A record's id, as the server actions accept it.
 *
 * Postgres issues UUIDs, and anything else is refused before it reaches the
 * database. Preview mode's sample records are named "v-06" and the like, and
 * with the UUID check alone Approve, Send back, Mark paid and changing a role
 * all failed there with "Invalid request." on every sample. PREVIEW is never
 * true in a production build, so real ids are checked as strictly as ever.
 */
export const recordId = PREVIEW ? z.string().min(1) : z.string().uuid();
