'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/analytics/ua';
import { SITE_URL } from '@/lib/marketing/content';

/**
 * Sign-in and sign-up, moved server-side.
 *
 * Both used to call `createClient().auth.signInWithPassword()` /
 * `.signUp()` straight from the browser — a direct request from the visitor's
 * own client to Supabase's auth API, which our own server never saw and so
 * could never rate-limit. Every other network-facing endpoint in this app
 * (see src/lib/ratelimit.ts and its callers) is gated by checkRateLimit();
 * these two were the exception only because of where the call happened to be
 * made from, not because the risk is any different — this is exactly where
 * credential stuffing and account-creation abuse land. Routing them through a
 * server action costs nothing else: it is still Supabase issuing the session,
 * this is just the one place that gets to ask "how often?" first.
 */

export type AuthResult =
  | { ok: true; hasSession: boolean }
  | { ok: false; error: string; code?: string };

async function ip(): Promise<string> {
  return clientIp(await headers()) ?? 'unknown';
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  // Two limits, two different attacks: one account guessed from anywhere
  // (keyed by email), and one address spraying many accounts (keyed by ip).
  const [byEmail, byIp] = await Promise.all([
    checkRateLimit(`login:email:${email}`, 8, 300),
    checkRateLimit(`login:ip:${await ip()}`, 30, 300),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return {
      ok: false,
      error: 'Too many attempts. Please wait a few minutes and try again.',
      code: 'rate_limited',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });

  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, hasSession: !!data.session };
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  next: string;
}): Promise<AuthResult> {
  // Keyed by address only: an account cannot yet exist to key on, and mass
  // account creation is the thing worth slowing down here.
  const rate = await checkRateLimit(`signup:ip:${await ip()}`, 6, 3600);
  if (!rate.allowed) {
    return {
      ok: false,
      error: 'Too many accounts created from this connection recently. Please try again later.',
      code: 'rate_limited',
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      // Read by the handle_new_user trigger to populate profiles.full_name,
      // which is what gets printed on the voucher as "Initiated By".
      data: { full_name: input.fullName.trim() },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(input.next)}`,
    },
  });

  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, hasSession: !!data.session };
}
