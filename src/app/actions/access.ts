'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { readVisitorCookie } from '@/lib/analytics/cookie';
import { emailConfigured, sendEmail } from '@/lib/notify';
import { CONTACT } from '@/lib/marketing/content';
import { logServerError } from '@/lib/errors/server';
import type { ActionResult } from './workflow';

/**
 * The public request-access form, and the in-product ask for a tool.
 *
 * Until now the contact page composed a mailto: and said so — honest, and a real
 * gap: nothing was recorded, nothing was searchable, and whether a request had
 * been answered depended on somebody's inbox. This is the missing half.
 *
 * The first of these is callable by a stranger, which sets the rules for it: it
 * validates, it is rate limited, and it writes through a SECURITY DEFINER
 * function rather than inserting, because `access_requests` has no insert policy
 * and the key in the browser bundle therefore cannot write a row.
 */

const requestSchema = z.object({
  name: z.string().trim().min(2, 'Give your name.').max(120),
  email: z.email('Give a valid email address.').max(200),
  company: z.string().trim().max(160).optional(),
  interest: z.string().trim().max(160).optional(),
  message: z.string().trim().max(4_000).optional(),
});

/**
 * The visitor's address, from whichever header the platform in front of us set.
 *
 * Kept so a request can be joined back to the browsing that led to it, which is
 * the difference between a name in a list and a name with an intent score
 * attached. First hop only: the rest of an x-forwarded-for chain is whatever the
 * client chose to claim.
 */
async function callerIp(): Promise<string | null> {
  const head = await headers();
  const forwarded = head.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return head.get('x-real-ip');
}

export async function requestAccess(input: {
  name: string;
  email: string;
  company?: string;
  interest?: string;
  message?: string;
}): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const ip = await callerIp();

  /*
   * Keyed on the address rather than on the IP. An office behind one address
   * would otherwise share an allowance, and three colleagues asking on the same
   * afternoon is a good day, not abuse. Generous, because the cost of a
   * duplicate here is a row somebody deletes, and the cost of a false refusal is
   * a lost enquiry.
   */
  const rate = await checkRateLimit(`access:${parsed.data.email.toLowerCase()}`, 5, 3_600);
  if (!rate.allowed) {
    return {
      ok: false,
      error: 'We already have a few requests from that address. Give us a little while to reply.',
    };
  }

  const head = await headers();
  const supabase = await createClient();

  const { error } = await supabase.rpc('submit_access_request', {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_company: parsed.data.company ?? null,
    p_interest: parsed.data.interest ?? null,
    p_message: parsed.data.message ?? null,
    p_ip: ip,
    p_source: head.get('referer') ?? null,
    p_visitor_id: readVisitorCookie(head.get('cookie')),
  });

  if (error) {
    await logServerError({
      route: '/actions/access',
      message: `Could not record an access request: ${error.message}`,
    });
    return {
      ok: false,
      error: `Something went wrong saving that. Write to ${CONTACT.email} and we will pick it up.`,
    };
  }

  /*
   * Told to us, not to them. No confirmation is sent to the person who filled
   * the form in: the page already says what happens next, and a second
   * "we got your message" email from an address nobody recognises is noise.
   */
  if (emailConfigured()) {
    void sendEmail({
      to: CONTACT.email,
      subject: `Access request from ${parsed.data.name}`,
      text: [
        `${parsed.data.name} <${parsed.data.email}>`,
        parsed.data.company ? `Organisation: ${parsed.data.company}` : null,
        parsed.data.interest ? `Interested in: ${parsed.data.interest}` : null,
        '',
        parsed.data.message ? parsed.data.message : 'No message given.',
      ]
        .filter((line) => line !== null)
        .join('\n'),
    });
  }

  return { ok: true, data: undefined };
}

/**
 * A signed-in person asking for a tool that is not live yet.
 *
 * Returns whether this was a new ask. False means they had already asked, which
 * is a settled state and not a failure — the button says so rather than showing
 * an error for pressing a thing twice.
 */
export async function requestFeature(
  slug: string,
  reason?: string,
): Promise<ActionResult<{ isNew: boolean }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('submit_feature_request', {
    p_slug: slug,
    p_reason: reason ?? null,
  });

  if (error) {
    return { ok: false, error: 'Could not record that request. Try again in a moment.' };
  }

  if (emailConfigured() && data === true) {
    void sendEmail({
      to: CONTACT.email,
      subject: `Tool requested: ${slug}`,
      // Plain text, and the reason is a separate line rather than interpolated
      // into a sentence: it is somebody else's writing, and it should not be
      // able to look like part of ours.
      text: [`Somebody asked for ${slug}.`, '', reason ? `Their reason:\n${reason}` : 'No reason given.'].join('\n'),
    });
  }

  return { ok: true, data: { isNew: data === true } };
}

/** Which tools the signed-in person has already asked for. */
export async function myFeatureRequests(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('requested_features');
  return Array.isArray(data) ? data : [];
}
