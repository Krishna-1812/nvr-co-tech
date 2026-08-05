import * as fixtures from './fixtures';
import { PREVIEW_USER_ID } from './fixtures';
import { financialYear } from '@/lib/domain/voucher';
import {
  canApproveVoucher,
  canMarkPaid,
  canReopen,
  isAdmin,
  isOwner,
  type UserRole,
  type VoucherLike,
} from '@/lib/domain/workflow';

/**
 * A small in-memory stand-in for supabase-js, covering exactly the calls this
 * app makes. Preview mode only — see ./index.ts for why it cannot run in
 * production.
 *
 * Two things it is NOT:
 *
 *  1. A test double. Nothing here proves the real queries work; it proves the
 *     components render given data of the right shape.
 *  2. The workflow. The RPCs below re-check permissions using the domain
 *     helpers, which mirror the Postgres functions and are unit-tested against
 *     them — but Postgres remains the only enforcement that counts. A voucher
 *     approved in preview was approved by a mirror of the rule, not the rule.
 *
 * State lives in module scope, so edits persist for the life of the dev server
 * and reset when it restarts.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/**
 * The tables, hung off globalThis rather than held in a module-level const.
 *
 * Turbopack compiles Route Handlers and Pages into separate server module graphs,
 * so a module-scoped `const TABLES` is instantiated once per graph. That silently
 * broke New voucher in preview: /vouchers/new is a Route Handler, it inserted the
 * draft into its own copy of the data, and the editor page it redirects to then
 * looked in a different copy and rendered a 404. Nothing was wrong with the
 * insert — the two halves of the flow were simply not looking at the same object.
 *
 * globalThis is shared by every graph in the process, which is the same reason the
 * Prisma docs tell you to cache a client there in development. Preview mode cannot
 * run in a production build (see ./index.ts), so this never ships.
 */
const globalForPreview = globalThis as typeof globalThis & { __fiPreviewTables?: Tables };

const TABLES: Tables = (globalForPreview.__fiPreviewTables ??= {
  profiles: fixtures.profiles as unknown as Row[],
  chapters: fixtures.chapters as unknown as Row[],
  events: fixtures.events as unknown as Row[],
  vouchers: fixtures.vouchers as unknown as Row[],
  voucher_attachments: fixtures.voucher_attachments as unknown as Row[],
  voucher_audit: fixtures.voucher_audit as unknown as Row[],
  user_settings: fixtures.user_settings as Row[],
  sheet_sync_log: fixtures.sheet_sync_log as Row[],
});

const me = () => TABLES.profiles.find((p) => p.id === PREVIEW_USER_ID)!;
const person = (id: unknown) => {
  const p = TABLES.profiles.find((r) => r.id === id);
  // The same three columns every embedded profile join in the app asks for. A
  // field missing here shows up as a preview-only blank — avatar_url did exactly
  // that: the pictures appeared on the people list, which reads the table
  // directly, and nowhere that reads a person through a join.
  return p ? { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url } : null;
};
const chapterRef = (id: unknown) => {
  const c = TABLES.chapters.find((r) => r.id === id);
  return c ? { name: c.name, code: c.code } : null;
};

/**
 * Resolve the embedded joins the pages ask for. The select string is ignored —
 * every relation a page might request is attached, and unread keys cost nothing.
 */
function enrich(table: string, row: Row): Row {
  if (table === 'vouchers') {
    return {
      ...row,
      chapter: chapterRef(row.chapter_id),
      paid_by: chapterRef(row.paid_by_chapter_id),
      initiator: person(row.initiated_by),
      creator: person(row.created_by),
      first_approver: person(row.approver_1),
      second_approver: person(row.approver_2),
      rejecter: person(row.rejected_by),
      payer: person(row.paid_marked_by),
      voucher_attachments: TABLES.voucher_attachments
        .filter((a) => a.voucher_id === row.id)
        .map((a) => ({ ...a })),
    };
  }
  if (table === 'voucher_audit') return { ...row, actor: person(row.actor_id) };
  if (table === 'events') return { ...row, chapter: chapterRef(row.chapter_id) };
  return { ...row };
}

const like = (value: unknown, pattern: string) =>
  new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i').test(
    String(value ?? ''),
  );

type Test = (row: Row) => boolean;

class Query implements PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  private tests: Test[] = [];
  private sort: { col: string; asc: boolean } | null = null;
  private take: number | null = null;
  private slice: [number, number] | null = null;
  private mode: 'many' | 'one' | 'maybe' = 'many';
  private wantCount = false;
  private headOnly = false;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this.wantCount = Boolean(opts?.count);
    this.headOnly = Boolean(opts?.head);
    return this;
  }

  eq(col: string, val: unknown) { this.tests.push((r) => String(r[col] ?? '') === String(val)); return this; }
  neq(col: string, val: unknown) { this.tests.push((r) => String(r[col] ?? '') !== String(val)); return this; }
  in(col: string, vals: unknown[]) { this.tests.push((r) => vals.map(String).includes(String(r[col]))); return this; }
  gte(col: string, val: unknown) { this.tests.push((r) => String(r[col] ?? '') >= String(val)); return this; }
  lte(col: string, val: unknown) { this.tests.push((r) => String(r[col] ?? '') <= String(val)); return this; }
  ilike(col: string, pattern: string) { this.tests.push((r) => like(r[col], pattern)); return this; }

  is(col: string, val: unknown) {
    this.tests.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) this.tests.push((r) => r[col] != null);
    else this.tests.push((r) => String(r[col] ?? '') !== String(val));
    return this;
  }

  /** `col.ilike.%x%,col2.ilike.%x%` — the search box's OR expression. */
  or(expr: string) {
    const clauses = expr.split(',').map((c) => {
      const first = c.indexOf('.');
      const second = c.indexOf('.', first + 1);
      return { col: c.slice(0, first), op: c.slice(first + 1, second), value: c.slice(second + 1) };
    });
    this.tests.push((r) =>
      clauses.some((c) => (c.op === 'ilike' ? like(r[c.col], c.value) : String(r[c.col] ?? '') === c.value)),
    );
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.sort = { col, asc: opts?.ascending !== false };
    return this;
  }

  limit(n: number) { this.take = n; return this; }
  range(from: number, to: number) { this.slice = [from, to]; return this; }
  single() { this.mode = 'one'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private run() {
    let rows = (TABLES[this.table] ?? []).filter((r) => this.tests.every((t) => t(r)));
    const count = rows.length;

    if (this.sort) {
      const { col, asc } = this.sort;
      rows = [...rows].sort((a, b) => {
        const x = a[col] ?? '';
        const y = b[col] ?? '';
        if (x === y) return 0;
        return (x < y ? -1 : 1) * (asc ? 1 : -1);
      });
    }

    if (this.slice) rows = rows.slice(this.slice[0], this.slice[1] + 1);
    if (this.take != null) rows = rows.slice(0, this.take);

    const data = rows.map((r) => enrich(this.table, r));

    if (this.headOnly) return { data: null, error: null, count };
    if (this.mode === 'one') {
      return data[0]
        ? { data: data[0], error: null, count }
        : { data: null, error: { message: 'No rows found' }, count };
    }
    if (this.mode === 'maybe') return { data: data[0] ?? null, error: null, count };
    return { data, error: null, count: this.wantCount ? count : null };
  }

  then<R1 = { data: unknown; error: unknown; count: number | null }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: unknown; count: number | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

function audit(voucher_id: string, action: string, extra: Row = {}) {
  const ids = TABLES.voucher_audit.map((a) => Number(a.id));
  TABLES.voucher_audit.push({
    id: (ids.length ? Math.max(...ids) : 0) + 1,
    voucher_id,
    actor_id: PREVIEW_USER_ID,
    action,
    from_status: null,
    to_status: null,
    note: null,
    changed: null,
    created_at: nowIso(),
    ...extra,
  });
}

class Writer implements PromiseLike<{ data: unknown; error: unknown }> {
  private returning = false;
  private one = false;

  constructor(private result: { data: unknown; error: unknown }) {}

  select() { this.returning = true; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  eq() { return this; }

  then<R1 = { data: unknown; error: unknown }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const data = this.returning || this.one ? this.result.data : null;
    return Promise.resolve({ ...this.result, data }).then(onfulfilled, onrejected);
  }
}

function table(name: string) {
  const rows = TABLES[name] ?? (TABLES[name] = []);

  return {
    select: (cols?: string, opts?: { count?: string; head?: boolean }) =>
      new Query(name).select(cols, opts),

    insert: (values: Row | Row[]) => {
      const list = Array.isArray(values) ? values : [values];
      const created = list.map((v) => {
        const row: Row = {
          id: `${name.slice(0, 2)}-${Math.random().toString(36).slice(2, 9)}`,
          created_at: nowIso(),
          updated_at: nowIso(),
          deleted_at: null,
          ...(name === 'vouchers'
            ? {
                status: 'draft',
                created_by: PREVIEW_USER_ID,
                initiated_by: PREVIEW_USER_ID,
                initiated_at: nowIso(),
                voucher_no: null,
                basic_value: 0, cgst: 0, sgst: 0, igst: 0, vat: 0,
                tds: 0, advance: 0, tips: 0, discount: 0,
                total_tax: 0, net_total: 0, grand_total: 0,
              }
            : {}),
          ...v,
        };
        rows.push(row);
        if (name === 'vouchers') audit(String(row.id), 'created', { to_status: 'draft' });
        return row;
      });
      return new Writer({ data: created[0] ?? null, error: null });
    },

    update: (values: Row) => {
      const q = {
        eq: (col: string, val: unknown) => {
          for (const r of rows) {
            if (String(r[col]) === String(val)) {
              Object.assign(r, values, { updated_at: nowIso() });
              // The three totals are GENERATED columns in Postgres; recompute
              // them here so preview cannot show an arithmetic it would reject.
              if (name === 'vouchers') recomputeTotals(r);
            }
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },

    delete: () => ({
      eq: (col: string, val: unknown) => {
        const i = rows.findIndex((r) => String(r[col]) === String(val));
        if (i >= 0) rows.splice(i, 1);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function recomputeTotals(r: Row) {
  const tax = num(r.cgst) + num(r.sgst) + num(r.igst);
  const net = num(r.basic_value) + tax + num(r.vat);
  r.total_tax = tax;
  r.net_total = net;
  r.grand_total = net - num(r.tds) - num(r.advance) + num(r.tips) - num(r.discount);
}

// ─── RPCs ────────────────────────────────────────────────────────────────────

const fail = (message: string) => ({ data: null, error: { message } });
const ok = (data: unknown = null) => ({ data, error: null });

function findVoucher(id: string) {
  return TABLES.vouchers.find((v) => v.id === id);
}

function nextVoucherNo(v: Row): string {
  const code = String(chapterRef(v.chapter_id)?.code ?? 'HO');
  const fy = financialYear(v.date ? new Date(String(v.date)) : new Date());
  // Matches 0007: the run of numbers is per chapter per financial year, and the
  // prefix is not part of what identifies the run. Anything issued before the
  // rename still counts, so the series does not restart at 0001.
  const tail = `/${code}/${fy}/`;
  const used = TABLES.vouchers
    .map((r) => String(r.voucher_no ?? ''))
    .filter((n) => n.includes(tail))
    .map((n) => Number(n.split('/').pop()));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `FI${tail}${String(next).padStart(4, '0')}`;
}

/** The actor, as the domain permission helpers expect them. */
const actor = () => ({ id: PREVIEW_USER_ID, role: me().role as UserRole });

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const id = String(args.p_id ?? '');
  const v = id ? findVoucher(id) : undefined;
  const a = actor();

  switch (fn) {
    case 'submit_voucher': {
      if (!v) return fail('Voucher not found.');
      if (!['draft', 'rejected'].includes(String(v.status))) return fail('Only a draft can be submitted.');
      if (!v.chapter_id || !v.paid_to || !v.date) {
        return fail('Chapter, date and payee are required before submitting.');
      }
      if (!v.voucher_no) v.voucher_no = nextVoucherNo(v);
      v.status = 'pending_first';
      v.submitted_at = nowIso();
      v.initiated_by = v.initiated_by ?? PREVIEW_USER_ID;
      v.rejected_by = null; v.rejected_at = null; v.rejection_reason = null;
      audit(id, 'submitted', { from_status: 'draft', to_status: 'pending_first' });
      return ok(v);
    }

    case 'approve_voucher': {
      if (!v) return fail('Voucher not found.');
      if (!canApproveVoucher(v as unknown as VoucherLike, a)) {
        return fail('You cannot approve this voucher.');
      }
      if (v.status === 'pending_first') {
        v.status = 'pending_second';
        v.approver_1 = PREVIEW_USER_ID;
        v.approved_1_at = nowIso();
        audit(id, 'approved_first', { from_status: 'pending_first', to_status: 'pending_second' });
      } else {
        v.status = 'approved';
        v.approver_2 = PREVIEW_USER_ID;
        v.approved_2_at = nowIso();
        audit(id, 'approved_second', { from_status: 'pending_second', to_status: 'approved' });
      }
      return ok(v);
    }

    case 'reject_voucher': {
      if (!v) return fail('Voucher not found.');
      const reason = String(args.p_reason ?? '').trim();
      if (!reason) return fail('A reason is required to send a voucher back.');
      if (!canApproveVoucher(v as unknown as VoucherLike, a)) {
        return fail('You cannot act on this voucher.');
      }
      const from = String(v.status);
      v.status = 'rejected';
      v.rejected_by = PREVIEW_USER_ID;
      v.rejected_at = nowIso();
      v.rejection_reason = reason;
      // Approvals already given are voided, so the next run starts clean.
      v.approver_1 = null; v.approved_1_at = null;
      v.approver_2 = null; v.approved_2_at = null;
      audit(id, 'rejected', { from_status: from, to_status: 'rejected', note: reason });
      return ok(v);
    }

    case 'reopen_voucher': {
      if (!v) return fail('Voucher not found.');
      if (!canReopen(v as unknown as VoucherLike, a)) return fail('You cannot reopen this voucher.');
      const from = String(v.status);
      v.status = 'draft';
      v.approver_1 = null; v.approved_1_at = null;
      v.approver_2 = null; v.approved_2_at = null;
      v.rejected_by = null; v.rejected_at = null; v.rejection_reason = null;
      audit(id, 'reopened', { from_status: from, to_status: 'draft', note: String(args.p_reason ?? '') || null });
      return ok(v);
    }

    case 'mark_voucher_paid': {
      if (!v) return fail('Voucher not found.');
      if (!canMarkPaid(v as unknown as VoucherLike, a)) return fail('Only an admin can mark an approved voucher paid.');
      const utr = String(args.p_utr ?? '').trim();
      if (!utr) return fail('A UTR or payment reference is required.');
      v.status = 'paid';
      v.utr_ref = utr;
      v.paid_marked_by = PREVIEW_USER_ID;
      v.paid_at = nowIso();
      v.payment_date = String(args.p_payment_date ?? nowIso().slice(0, 10));
      audit(id, 'marked_paid', { from_status: 'approved', to_status: 'paid', note: `UTR ${utr}` });
      return ok(v);
    }

    case 'soft_delete_voucher': {
      if (!v) return fail('Voucher not found.');
      v.deleted_at = nowIso();
      audit(id, 'deleted', { note: String(args.p_reason ?? '') || null });
      return ok(v);
    }

    case 'restore_voucher': {
      if (!v) return fail('Voucher not found.');
      v.deleted_at = null;
      audit(id, 'restored');
      return ok(v);
    }

    case 'purge_voucher': {
      if (!v) return fail('Voucher not found.');
      const everApproved = TABLES.voucher_audit.some(
        (e) => e.voucher_id === id && ['approved_second', 'marked_paid'].includes(String(e.action)),
      );
      if (everApproved) return fail('A voucher that was approved keeps its record permanently.');
      TABLES.vouchers.splice(TABLES.vouchers.indexOf(v), 1);
      return ok();
    }

    case 'set_user_role': {
      const target = TABLES.profiles.find((p) => p.id === args.p_user);
      if (!target) return fail('User not found.');
      if (!isOwner(a.role)) return fail('Only an owner can change roles.');
      if (target.id === a.id) return fail('You cannot change your own role.');
      if (target.role === 'owner') return fail('An owner’s role cannot be changed.');
      target.role = args.p_role;
      return ok(target);
    }

    case 'set_chapter_active': {
      const c = TABLES.chapters.find((x) => x.id === args.p_id);
      if (!c) return fail('Chapter not found.');
      if (c.is_head_office && args.p_active === false) return fail('Head office cannot be retired.');
      c.is_active = args.p_active;
      return ok(c);
    }

    case 'rename_chapter': {
      const c = TABLES.chapters.find((x) => x.id === args.p_id);
      if (!c) return fail('Chapter not found.');
      if (!isAdmin(a.role)) return fail('Only an admin can rename a chapter.');
      c.name = String(args.p_name ?? '').trim();
      return ok(c);
    }

    default:
      return fail(`${fn} is not available in preview mode.`);
  }
}

// ─── The client ──────────────────────────────────────────────────────────────

export function createPreviewClient() {
  const profile = me();

  return {
    from: table,
    rpc,
    auth: {
      getUser: async () => ({
        data: { user: { id: PREVIEW_USER_ID, email: profile.email } },
        error: null,
      }),
      getSession: async () => ({ data: { session: { user: { id: PREVIEW_USER_ID } } }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Preview mode is already signed in.' } }),
      signUp: async () => ({ data: null, error: { message: 'Preview mode is already signed in.' } }),
      signInWithOAuth: async () => ({ data: null, error: { message: 'Preview mode is already signed in.' } }),
      exchangeCodeForSession: async () => ({ data: null, error: { message: 'Preview mode is already signed in.' } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'Uploads need a real Storage bucket.' } }),
        remove: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({
          data: null,
          error: { message: 'This is sample data — there is no file behind it.' },
        }),
      }),
    },
  };
}
