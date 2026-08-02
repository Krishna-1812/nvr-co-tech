/**
 * Preview mode — the app running on fabricated data, with no database.
 *
 * It exists so the screens can be looked at and shown to the client before a
 * Supabase project is provisioned. It is NOT a test environment: nothing here
 * exercises RLS, the workflow functions, or any constraint. Every rule this app
 * relies on lives in Postgres, and none of it is running in preview.
 *
 * ── Why the double gate ──────────────────────────────────────────────────────
 * Preview replaces the authenticated user with a fixture and lets the proxy wave
 * every request through. In a deployed app that is a total authentication
 * bypass. So it requires BOTH an explicit opt-in flag AND a non-production
 * build: `next build` and `next start` both set NODE_ENV=production, so a
 * deployed instance cannot enter preview mode even if the flag is set on it.
 *
 * Turn it on for local viewing with, in .env.local:
 *   NEXT_PUBLIC_PREVIEW_MODE=1
 *
 * The NEXT_PUBLIC_ prefix is needed because the browser bundle reads it too —
 * the sign-out button and the attachment uploader talk to Supabase directly.
 */
export const PREVIEW =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_PREVIEW_MODE === '1';

/** Shown wherever preview mode disables a real action. */
export const PREVIEW_NOTICE =
  'Preview mode: no database is connected, so nothing can be saved.';
