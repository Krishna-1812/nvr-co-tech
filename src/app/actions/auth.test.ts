import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, signUp } from './auth';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';

/**
 * These two used to be direct browser calls to Supabase, invisible to our own
 * server and so impossible to rate-limit (see auth.ts). What matters here is
 * exactly that: a tripped limit must refuse before Supabase is ever called,
 * not just report an error afterwards.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.5' })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: vi.fn() }));

function mockAuth(result: { data?: unknown; error?: unknown }) {
  const signInWithPassword = vi
    .fn()
    .mockResolvedValue({ data: result.data ?? { session: null }, error: result.error ?? null });
  const supabaseSignUp = vi
    .fn()
    .mockResolvedValue({ data: result.data ?? { session: null }, error: result.error ?? null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword, signUp: supabaseSignUp },
  } as never);
  return { signInWithPassword, signUp: supabaseSignUp };
}

describe('signIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lower-cases the email and forwards it to Supabase once both limits allow it', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    const { signInWithPassword } = mockAuth({ data: { session: {} } });

    const res = await signIn({ email: 'Person@Example.com', password: 'secret123' });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'secret123',
    });
    expect(res).toEqual({ ok: true, hasSession: true });
  });

  it('refuses to call Supabase at all once a rate limit trips', async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 }) // by email
      .mockResolvedValueOnce({ allowed: true }); // by ip
    const { signInWithPassword } = mockAuth({});

    const res = await signIn({ email: 'a@b.com', password: 'x' });

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('rate_limited');
  });

  it('surfaces a Supabase auth error together with its code', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    mockAuth({ error: { message: 'Email not confirmed', code: 'email_not_confirmed' } });

    const res = await signIn({ email: 'a@b.com', password: 'x' });

    expect(res).toEqual({ ok: false, error: 'Email not confirmed', code: 'email_not_confirmed' });
  });
});

describe('signUp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to call Supabase once the per-address signup limit trips', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });
    const { signUp: supabaseSignUp } = mockAuth({});

    const res = await signUp({ email: 'a@b.com', password: 'x', fullName: 'A', next: '/hub' });

    expect(supabaseSignUp).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
  });

  it('reports whether a session came back immediately', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    mockAuth({ data: { session: null } });

    const res = await signUp({ email: 'a@b.com', password: 'x', fullName: 'A', next: '/hub' });

    expect(res).toEqual({ ok: true, hasSession: false });
  });
});
