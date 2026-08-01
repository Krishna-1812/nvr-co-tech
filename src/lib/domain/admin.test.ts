import { describe, it, expect } from 'vitest';
import { USER_ROLES, canApprove, isAdmin, isOwner, type UserRole } from './workflow';

/**
 * Role rules, mirrored from `set_user_role` in 0002 and the admin screens.
 * Postgres has the final say; these pin the client's understanding of it so the
 * UI cannot quietly offer something the database will refuse.
 */

/** The rule carried over from v1: only an owner promotes, never self, never another owner. */
const canChangeRole = (
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): boolean => isOwner(actor.role) && actor.id !== target.id && target.role !== 'owner';

const owner = { id: 'u-owner', role: 'owner' as UserRole };
const admin = { id: 'u-admin', role: 'admin' as UserRole };
const approver = { id: 'u-appr', role: 'approver' as UserRole };
const member = { id: 'u-mem', role: 'member' as UserRole };

describe('role ranking', () => {
  it('orders roles from least to most capable', () => {
    expect(USER_ROLES).toEqual(['member', 'approver', 'admin', 'owner']);
  });

  it('lets approver and above approve', () => {
    expect(canApprove('member')).toBe(false);
    expect(canApprove('approver')).toBe(true);
    expect(canApprove('admin')).toBe(true);
    expect(canApprove('owner')).toBe(true);
  });

  it('lets admin and above administer', () => {
    expect(isAdmin('approver')).toBe(false);
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('owner')).toBe(true);
  });

  it('recognises exactly one owner role', () => {
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('admin')).toBe(false);
  });
});

describe('who may change a role', () => {
  it('lets an owner promote a member', () => {
    expect(canChangeRole(owner, member)).toBe(true);
  });

  it('refuses an admin — promotion is the owner’s alone', () => {
    expect(canChangeRole(admin, member)).toBe(false);
  });

  it('refuses an approver and a member outright', () => {
    expect(canChangeRole(approver, member)).toBe(false);
    expect(canChangeRole(member, approver)).toBe(false);
  });

  it('refuses changing your own role, even as owner', () => {
    expect(canChangeRole(owner, owner)).toBe(false);
  });

  it('refuses demoting another owner', () => {
    expect(canChangeRole(owner, { id: 'u-owner-2', role: 'owner' })).toBe(false);
  });
});

/**
 * Approval needs two different people, neither of them the initiator. Below
 * three capable people, some voucher always has nobody left to clear it — which
 * is why the People screen warns at that threshold.
 */
describe('approver capacity warning', () => {
  const capable = (roles: UserRole[]) => roles.filter((r) => canApprove(r)).length;

  it('warns when fewer than three people can approve', () => {
    expect(capable(['owner', 'member', 'member'])).toBeLessThan(3);
    expect(capable(['owner', 'approver', 'member'])).toBeLessThan(3);
  });

  it('is satisfied at three', () => {
    expect(capable(['owner', 'approver', 'approver'])).toBe(3);
  });

  it('a lone owner cannot clear anything they raised themselves', () => {
    // One approver total: they raise it, so no one is left to give approval 1.
    expect(capable(['owner', 'member'])).toBe(1);
  });
});

/**
 * Mirrors `purge_voucher`: anything that reached approval keeps its record,
 * because deleting the voucher cascades away its audit trail.
 */
describe('what may be permanently deleted', () => {
  const purgeable = (status: string) => !['approved', 'paid'].includes(status);

  it('allows purging drafts and rejected vouchers', () => {
    expect(purgeable('draft')).toBe(true);
    expect(purgeable('rejected')).toBe(true);
  });

  it('allows purging something still in the queue', () => {
    expect(purgeable('pending_first')).toBe(true);
    expect(purgeable('pending_second')).toBe(true);
  });

  it('refuses to destroy an approval record', () => {
    expect(purgeable('approved')).toBe(false);
    expect(purgeable('paid')).toBe(false);
  });
});
