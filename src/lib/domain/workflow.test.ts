import { describe, it, expect } from 'vitest';
import {
  canApproveVoucher,
  approvalBlockedReason,
  canEdit,
  canReopen,
  canMarkPaid,
  type VoucherActor,
  type VoucherLike,
} from './workflow';

const alice: VoucherActor = { id: 'alice', role: 'member' };
const bob: VoucherActor = { id: 'bob', role: 'approver' };
const carol: VoucherActor = { id: 'carol', role: 'approver' };
const admin: VoucherActor = { id: 'admin', role: 'admin' };

const voucher = (over: Partial<VoucherLike> = {}): VoucherLike => ({
  status: 'pending_first',
  created_by: 'alice',
  initiated_by: 'alice',
  approver_1: null,
  ...over,
});

// Segregation of duties is the whole point of the rebuild. v1 let the person
// raising a voucher type any name into "1st Approval Done By".
describe('segregation of duties', () => {
  it('lets an approver approve someone else’s voucher', () => {
    expect(canApproveVoucher(voucher(), bob)).toBe(true);
  });

  it('never lets you approve a voucher you raised', () => {
    const own = voucher({ created_by: 'bob', initiated_by: 'bob' });
    expect(canApproveVoucher(own, bob)).toBe(false);
    expect(approvalBlockedReason(own, bob)).toMatch(/you raised this voucher/i);
  });

  it('blocks self-approval even for an admin', () => {
    const own = voucher({ created_by: 'admin', initiated_by: 'admin' });
    expect(canApproveVoucher(own, admin)).toBe(false);
  });

  it('requires the second approver to differ from the first', () => {
    const v = voucher({ status: 'pending_second', approver_1: 'bob' });
    expect(canApproveVoucher(v, bob)).toBe(false);
    expect(approvalBlockedReason(v, bob)).toMatch(/second person/i);
    expect(canApproveVoucher(v, carol)).toBe(true);
  });

  it('does not let a plain member approve anything', () => {
    const v = voucher({ created_by: 'someone-else', initiated_by: 'someone-else' });
    expect(canApproveVoucher(v, alice)).toBe(false);
    expect(approvalBlockedReason(v, alice)).toMatch(/permission/i);
  });

  it('only allows approval while the voucher is actually pending', () => {
    for (const status of ['draft', 'approved', 'rejected', 'paid'] as const) {
      expect(canApproveVoucher(voucher({ status }), bob)).toBe(false);
    }
  });
});

describe('editing', () => {
  it('is allowed on your own draft or a voucher sent back to you', () => {
    expect(canEdit(voucher({ status: 'draft' }), alice)).toBe(true);
    expect(canEdit(voucher({ status: 'rejected' }), alice)).toBe(true);
  });

  it('is blocked once submitted, approved or paid', () => {
    for (const status of ['pending_first', 'pending_second', 'approved', 'paid'] as const) {
      expect(canEdit(voucher({ status }), alice)).toBe(false);
    }
  });

  it('is blocked on someone else’s voucher unless you are an admin', () => {
    const v = voucher({ status: 'draft', created_by: 'someone-else' });
    expect(canEdit(v, bob)).toBe(false);
    expect(canEdit(v, admin)).toBe(true);
  });
});

describe('reopening', () => {
  it('lets the person who raised it reopen a rejected voucher', () => {
    expect(canReopen(voucher({ status: 'rejected' }), alice)).toBe(true);
  });

  it('only lets an admin reopen an approved voucher', () => {
    expect(canReopen(voucher({ status: 'approved' }), alice)).toBe(false);
    expect(canReopen(voucher({ status: 'approved' }), bob)).toBe(false);
    expect(canReopen(voucher({ status: 'approved' }), admin)).toBe(true);
  });

  it('never reopens a paid voucher', () => {
    expect(canReopen(voucher({ status: 'paid' }), admin)).toBe(false);
  });
});

describe('marking paid', () => {
  it('is admin-only and only from approved', () => {
    expect(canMarkPaid(voucher({ status: 'approved' }), admin)).toBe(true);
    expect(canMarkPaid(voucher({ status: 'approved' }), bob)).toBe(false);
    expect(canMarkPaid(voucher({ status: 'pending_second' }), admin)).toBe(false);
  });
});
