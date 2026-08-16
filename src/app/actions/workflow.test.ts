import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitVoucher, approveVoucher, rejectVoucher, markVoucherPaid } from './workflow';
import { createClient } from '@/lib/supabase/server';

/**
 * The server actions themselves, not the SQL functions they call.
 *
 * Everything past `supabase.rpc(...)` is Postgres's job and is out of reach
 * without a live database — these instead pin the two things this layer is
 * actually responsible for: that each action calls the right RPC with the
 * right arguments, and that a bare Postgres exception comes back as a
 * message worth reading rather than raw PL/pgSQL noise.
 */

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

function mockRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

// zod's .uuid() checks the version/variant nibbles too, not just the shape —
// an all-1s string fails it, so this needs to look like a real v4 UUID.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('workflow server actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submitVoucher calls submit_voucher and reports the assigned number', async () => {
    const rpc = mockRpc({ data: { voucher_no: 'FI/HO/26-27/0001' } });
    const res = await submitVoucher(UUID);
    expect(rpc).toHaveBeenCalledWith('submit_voucher', { p_id: UUID });
    expect(res).toEqual({ ok: true, data: { voucherNo: 'FI/HO/26-27/0001' } });
  });

  it('strips PL/pgSQL context noise from a bare Postgres exception', async () => {
    mockRpc({
      error: { message: 'ERROR:  Chapter is required\nCONTEXT:  PL/pgSQL function submit_voucher' },
    });
    const res = await submitVoucher(UUID);
    expect(res).toEqual({ ok: false, error: 'Chapter is required' });
  });

  it('approveVoucher never reaches the database with a malformed id', async () => {
    const rpc = mockRpc({});
    const res = await approveVoucher({ id: 'not-a-uuid' });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('approveVoucher passes an optional note through to approve_voucher', async () => {
    const rpc = mockRpc({ data: { status: 'approved' } });
    const res = await approveVoucher({ id: UUID, note: 'looks right' });
    expect(rpc).toHaveBeenCalledWith('approve_voucher', { p_id: UUID, p_note: 'looks right' });
    expect(res).toEqual({ ok: true, data: { status: 'approved' } });
  });

  it('rejectVoucher requires a real reason before ever calling the database', async () => {
    const rpc = mockRpc({});
    const res = await rejectVoucher({ id: UUID, reason: 'x' });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejectVoucher passes a valid reason through to reject_voucher', async () => {
    const rpc = mockRpc({ data: null });
    const res = await rejectVoucher({ id: UUID, reason: 'Missing invoice copy' });
    expect(rpc).toHaveBeenCalledWith('reject_voucher', {
      p_id: UUID,
      p_reason: 'Missing invoice copy',
    });
    expect(res.ok).toBe(true);
  });

  it('markVoucherPaid passes the UTR and an optional payment date through', async () => {
    const rpc = mockRpc({ data: null });
    const res = await markVoucherPaid({ id: UUID, utr: 'UTR1234567', paymentDate: '2026-08-16' });
    expect(rpc).toHaveBeenCalledWith('mark_voucher_paid', {
      p_id: UUID,
      p_utr: 'UTR1234567',
      p_payment_date: '2026-08-16',
    });
    expect(res.ok).toBe(true);
  });

  it('markVoucherPaid rejects a UTR that is too short before calling the database', async () => {
    const rpc = mockRpc({});
    const res = await markVoucherPaid({ id: UUID, utr: 'x' });
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
