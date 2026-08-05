'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import { Check, Cloud, CloudOff, Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_RULES,
  SPONSORSHIPS,
  SUPPORTING_TYPES,
  calcTax,
  calcNetTotal,
  calcGrandTotal,
  fmtRupees,
  gstMode,
  alphaNumeric,
  paidByChapterOptions,
  type Chapter,
  type SupportingType,
} from '@/lib/domain/voucher';
import { crossFieldIssues, submitReadiness } from '@/lib/domain/schema';
import { saveDraft, deleteDraft } from '@/app/actions/voucher';
import { submitVoucher } from '@/app/actions/workflow';
import {
  Button,
  Card,
  ChoicePill,
  ComputedField,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { EventPicker } from './EventPicker';

export type EventOption = {
  id: string;
  name: string;
  date_of_event: string | null;
  chapter_id: string | null;
};

type FormState = Record<string, string>;

const SECTIONS = [
  { id: 'info', label: 'Voucher info' },
  { id: 'event', label: 'Event & supporting' },
  { id: 'amounts', label: 'Amounts' },
  { id: 'payment', label: 'Payment details' },
] as const;

/** Amount fields default to 0 in Postgres; showing that as a pre-filled "0" just
 *  invites the user to type next to it. Blank means the same thing to `money`. */
const ZERO_AS_BLANK = new Set([
  'basic_value',
  'cgst',
  'sgst',
  'igst',
  'vat',
  'tds',
  'advance',
  'tips',
  'discount',
]);

/** Turn a database row into flat string state — inputs are strings. */
function toFormState(v: Record<string, unknown>): FormState {
  const s: FormState = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === null || val === undefined) {
      s[k] = '';
    } else if (ZERO_AS_BLANK.has(k) && Number(val) === 0) {
      s[k] = '';
    } else {
      s[k] = String(val);
    }
  }
  return s;
}

export function VoucherForm({
  voucher,
  chapters,
  events,
}: {
  voucher: Record<string, unknown> & { id: string; status: string };
  chapters: Chapter[];
  events: EventOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(voucher));
  const [eventList, setEventList] = useState(events);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((key: string, value: string) => {
    dirty.current = true;
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // ─── Derived values ────────────────────────────────────────────────────────

  const totals = useMemo(
    () => ({
      tax: calcTax(form),
      net: calcNetTotal(form),
      grand: calcGrandTotal(form),
    }),
    [form],
  );

  const { usingCgstSgst, usingIgst } = gstMode(form);

  const paidByOptions = useMemo(
    () => paidByChapterOptions(chapters, form.chapter_id || null),
    [chapters, form.chapter_id],
  );

  const issues = useMemo(() => crossFieldIssues(form), [form]);
  const blockers = useMemo(() => submitReadiness(form), [form]);
  const errorFor = (path: string) =>
    showErrors
      ? (blockers.find((i) => i.path === path)?.message ?? issues.find((i) => i.path === path)?.message)
      : issues.find((i) => i.path === path)?.message;

  // ─── Autosave ──────────────────────────────────────────────────────────────
  //
  // Debounced so typing does not hammer the database, and fire-and-forget so it
  // never blocks the user. Unlike v1's sheet sync, a failure is *shown* — a
  // silent save failure on a 32-field form would be maddening.

  const persist = useCallback(async (snapshot: FormState) => {
    setSaveState('saving');
    const res = await saveDraft(voucher.id, {
      date: snapshot.date,
      chapter_id: snapshot.chapter_id || null,
      sponsored: snapshot.sponsored || null,
      event_id: snapshot.event_id || null,
      event_name: snapshot.event_name,
      event_date: snapshot.event_date,
      event_narration: snapshot.event_narration,
      type_of_supporting: snapshot.type_of_supporting || null,
      type_of_payment: snapshot.type_of_payment || null,
      invoice_no: snapshot.invoice_no,
      invoice_date: snapshot.invoice_date,
      invoice_received_date: snapshot.invoice_received_date,
      basic_value: snapshot.basic_value,
      cgst: snapshot.cgst,
      sgst: snapshot.sgst,
      igst: snapshot.igst,
      vat: snapshot.vat,
      tds: snapshot.tds,
      advance: snapshot.advance,
      tips: snapshot.tips,
      discount: snapshot.discount,
      paid_to: snapshot.paid_to,
      paid_by_chapter_id: snapshot.paid_by_chapter_id || null,
      payment_date: snapshot.payment_date,
      beneficiary_name: snapshot.beneficiary_name,
      utr_ref: snapshot.utr_ref,
      pan_number: snapshot.pan_number,
      gst_number: snapshot.gst_number,
    });
    setSaveState(res.ok ? 'saved' : 'error');
    if (!res.ok) toast.error(res.error);
  }, [voucher.id]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    // setState happens inside the timer callback, never synchronously here.
    timer.current = setTimeout(() => void persist(form), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, persist]);

  // Flush pending edits if the tab is closed or hidden mid-typing.
  useEffect(() => {
    const flush = () => {
      if (dirty.current && timer.current) {
        clearTimeout(timer.current);
        void persist(form);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [form, persist]);

  // ─── Dependent-field rules ─────────────────────────────────────────────────

  /** Choosing a supporting type resets the payment: auto for the fixed ones. */
  const pickSupporting = (value: SupportingType) => {
    dirty.current = true;
    setForm((f) => ({
      ...f,
      type_of_supporting: value,
      type_of_payment: PAYMENT_RULES[value].auto ?? '',
    }));
  };

  /** Changing chapter drops Paid By Chapter if it is no longer permitted. */
  const pickChapter = (chapterId: string) => {
    dirty.current = true;
    setForm((f) => {
      const allowed = paidByChapterOptions(chapters, chapterId).map((c) => c.id);
      return {
        ...f,
        chapter_id: chapterId,
        paid_by_chapter_id: allowed.includes(f.paid_by_chapter_id) ? f.paid_by_chapter_id : '',
      };
    });
  };

  /** Selecting an event fills its name, date and chapter. */
  const pickEvent = (ev: EventOption | null) => {
    dirty.current = true;
    setForm((f) => ({
      ...f,
      event_id: ev?.id ?? '',
      event_name: ev?.name ?? '',
      event_date: ev?.date_of_event ?? '',
      chapter_id: f.chapter_id || ev?.chapter_id || '',
    }));
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = () => {
    setShowErrors(true);
    if (blockers.length > 0) {
      toast.error(blockers[0].message);
      document.getElementById(`f-${blockers[0].path}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }

    startSubmit(async () => {
      // Make sure the last keystroke is on disk before the workflow reads the row.
      if (timer.current) clearTimeout(timer.current);
      await persist(form);

      const res = await submitVoucher(voucher.id);
      if (res.ok) {
        toast.success(`${res.data.voucherNo} submitted for approval.`);
        router.push(`/vouchers/${voucher.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  const onDelete = () => {
    startSubmit(async () => {
      const res = await deleteDraft(voucher.id);
      if (res.ok) {
        toast.success('Draft deleted.');
        router.push('/vouchers');
      } else toast.error(res.error);
    });
  };

  const rule = form.type_of_supporting
    ? PAYMENT_RULES[form.type_of_supporting as SupportingType]
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        {/* ── 1. Voucher info ── */}
        <Card id="info">
          <SectionHead step={1} title="Voucher info" />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Voucher date" htmlFor="f-date">
              <Input id="f-date" type="date" value={form.date ?? ''} onChange={(e) => set('date', e.target.value)} />
            </Field>

            <Field label="Chapter" htmlFor="f-chapter_id" required error={errorFor('chapter_id')}>
              <Select
                id="f-chapter_id"
                value={form.chapter_id ?? ''}
                onChange={(e) => pickChapter(e.target.value)}
              >
                <option value="">Select chapter</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Voucher number"
              className="sm:col-span-2"
              hint="Assigned automatically when you submit — FI/CHAPTER/FY/0001."
            >
              <Input
                value={(voucher.voucher_no as string) || 'Not yet assigned'}
                disabled
                className="numeric"
              />
            </Field>

            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium">Sponsored / Non-Sponsored event</p>
              <div className="flex flex-wrap gap-2.5">
                {SPONSORSHIPS.map((opt) => (
                  <ChoicePill
                    key={opt}
                    name="sponsored"
                    value={opt}
                    checked={form.sponsored === opt}
                    onChange={() => set('sponsored', opt)}
                  >
                    {opt}
                  </ChoicePill>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ── 2. Event & supporting ── */}
        <Card id="event">
          <SectionHead step={2} title="Event & supporting document" />
          <div className="space-y-5 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <EventPicker
                events={eventList}
                chapters={chapters}
                value={form.event_id ?? ''}
                onPick={pickEvent}
                onCreated={(ev) => {
                  setEventList((l) => [ev, ...l]);
                  pickEvent(ev);
                }}
              />
              <Field label="Event date" hint="Filled from the event; override if needed.">
                <Input
                  type="date"
                  value={form.event_date ?? ''}
                  onChange={(e) => set('event_date', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Event narration">
              <Textarea
                value={form.event_narration ?? ''}
                onChange={(e) => set('event_narration', e.target.value)}
                placeholder="Brief description of what this payment covers."
              />
            </Field>

            <div id="f-type_of_supporting">
              <p className="mb-2 text-sm font-medium">
                Type of supporting <span className="text-red-500">*</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SUPPORTING_TYPES.map((opt) => (
                  <ChoicePill
                    key={opt}
                    name="type_of_supporting"
                    value={opt}
                    checked={form.type_of_supporting === opt}
                    onChange={() => pickSupporting(opt)}
                  >
                    {opt}
                  </ChoicePill>
                ))}
              </div>
              {errorFor('type_of_supporting') && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {errorFor('type_of_supporting')}
                </p>
              )}
            </div>

            {/* Payment type is constrained by the supporting document. */}
            {rule && (
              <div id="f-type_of_payment">
                <p className="mb-2 text-sm font-medium">Type of payment</p>
                {rule.auto ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
                    <Check className="size-4" aria-hidden />
                    {form.type_of_payment}
                    <span className="text-xs font-medium opacity-70">
                      · set by “{form.type_of_supporting}”
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {rule.options.map((opt) => (
                      <ChoicePill
                        key={opt}
                        name="type_of_payment"
                        value={opt}
                        checked={form.type_of_payment === opt}
                        onChange={() => set('type_of_payment', opt)}
                      >
                        {opt}
                      </ChoicePill>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Invoice number">
                <Input
                  value={form.invoice_no ?? ''}
                  onChange={(e) => set('invoice_no', e.target.value)}
                />
              </Field>
              <Field label="Invoice date">
                <Input
                  type="date"
                  value={form.invoice_date ?? ''}
                  onChange={(e) => set('invoice_date', e.target.value)}
                />
              </Field>
              <Field label="Invoice received date">
                <Input
                  type="date"
                  value={form.invoice_received_date ?? ''}
                  onChange={(e) => set('invoice_received_date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* ── 3. Amounts ── */}
        <Card id="amounts">
          <SectionHead step={3} title="Amount breakdown" />
          <div className="space-y-5 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Basic value (A)" htmlFor="f-basic_value" error={errorFor('basic_value')}>
                <Input
                  id="f-basic_value"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="numeric"
                  value={form.basic_value ?? ''}
                  onChange={(e) => set('basic_value', e.target.value)}
                />
              </Field>
              <Field label="VAT / other charges (C)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="numeric"
                  value={form.vat ?? ''}
                  onChange={(e) => set('vat', e.target.value)}
                />
              </Field>
            </div>

            {/*
              GST is intra-state (CGST+SGST) or inter-state (IGST) — never both.
              Disabling the opposite side makes the rule obvious before the user
              can break it, rather than erroring after the fact.
            */}
            <div className="surface-sunken rounded-lg p-4">
              <p className="text-muted text-xs">
                Use <strong>CGST + SGST</strong> for the same state, or <strong>IGST</strong> for
                another state — not both. Clear one side to switch.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="CGST" htmlFor="f-cgst" error={errorFor('cgst')}>
                  <Input
                    id="f-cgst"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="numeric"
                    disabled={usingIgst}
                    value={form.cgst ?? ''}
                    onChange={(e) => set('cgst', e.target.value)}
                  />
                </Field>
                <Field label="SGST" htmlFor="f-sgst" error={errorFor('sgst')}>
                  <Input
                    id="f-sgst"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="numeric"
                    disabled={usingIgst}
                    value={form.sgst ?? ''}
                    onChange={(e) => set('sgst', e.target.value)}
                  />
                </Field>
                <Field label="IGST" htmlFor="f-igst" error={errorFor('igst')}>
                  <Input
                    id="f-igst"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="numeric"
                    disabled={usingCgstSgst}
                    value={form.igst ?? ''}
                    onChange={(e) => set('igst', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ComputedField label="Total tax (B = CGST + SGST + IGST)" value={fmtRupees(totals.tax)} />
              <ComputedField label="Net total (A + B + C)" value={fmtRupees(totals.net)} />
            </div>

            <div className="grid gap-5 sm:grid-cols-4">
              <Field label="(−) TDS (E)">
                <Input type="number" step="0.01" min="0" inputMode="decimal" className="numeric"
                  value={form.tds ?? ''} onChange={(e) => set('tds', e.target.value)} />
              </Field>
              <Field label="(−) Advance (G)">
                <Input type="number" step="0.01" min="0" inputMode="decimal" className="numeric"
                  value={form.advance ?? ''} onChange={(e) => set('advance', e.target.value)} />
              </Field>
              <Field label="(+) Tips (H)">
                <Input type="number" step="0.01" min="0" inputMode="decimal" className="numeric"
                  value={form.tips ?? ''} onChange={(e) => set('tips', e.target.value)} />
              </Field>
              <Field label="(−) Discount (I)">
                <Input type="number" step="0.01" min="0" inputMode="decimal" className="numeric"
                  value={form.discount ?? ''} onChange={(e) => set('discount', e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        {/* ── 4. Payment details ── */}
        <Card id="payment">
          <SectionHead step={4} title="Payment details" />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Paid to" htmlFor="f-paid_to" required error={errorFor('paid_to')}>
              <Input
                id="f-paid_to"
                value={form.paid_to ?? ''}
                onChange={(e) => set('paid_to', e.target.value)}
                placeholder="Vendor or payee name"
              />
            </Field>

            <Field
              label="Paid by chapter"
              hint="Head office, or the chapter this voucher belongs to."
            >
              <Select
                value={form.paid_by_chapter_id ?? ''}
                onChange={(e) => set('paid_by_chapter_id', e.target.value)}
                disabled={!form.chapter_id}
              >
                <option value="">{form.chapter_id ? 'Select chapter' : 'Choose a chapter first'}</option>
                {paidByOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Payment date" htmlFor="f-payment_date" error={errorFor('payment_date')}>
              <Input
                id="f-payment_date"
                type="date"
                value={form.payment_date ?? ''}
                onChange={(e) => set('payment_date', e.target.value)}
              />
            </Field>

            <Field label="Beneficiary name">
              <Input
                value={form.beneficiary_name ?? ''}
                onChange={(e) => set('beneficiary_name', alphaNumeric(e.target.value))}
              />
            </Field>

            <Field label="UTR / reference number">
              <Input
                className="numeric"
                value={form.utr_ref ?? ''}
                onChange={(e) => set('utr_ref', alphaNumeric(e.target.value))}
              />
            </Field>

            <Field label="PAN number" htmlFor="f-pan_number" hint="Optional" error={errorFor('pan_number')}>
              <Input
                id="f-pan_number"
                className="numeric uppercase"
                maxLength={10}
                placeholder="ABCDE1234F"
                value={form.pan_number ?? ''}
                onChange={(e) => set('pan_number', alphaNumeric(e.target.value).toUpperCase())}
              />
            </Field>

            <Field label="GST number" htmlFor="f-gst_number" hint="Optional" error={errorFor('gst_number')}>
              <Input
                id="f-gst_number"
                className="numeric uppercase"
                maxLength={15}
                placeholder="22ABCDE1234F1Z5"
                value={form.gst_number ?? ''}
                onChange={(e) => set('gst_number', alphaNumeric(e.target.value).toUpperCase())}
              />
            </Field>
          </div>
        </Card>

        {/*
          Approvals are no longer typed in by hand. v1 had three free-text name
          boxes here; the workflow now records who actually acted, and when.
        */}
        <Card className="border-dashed p-5">
          <p className="text-sm font-medium">Approvals</p>
          <p className="text-muted mt-1 text-sm">
            You no longer type approver names. When you submit, this voucher enters the approval
            queue and records who approves it — two different people, neither of them you.
          </p>
        </Card>
      </div>

      {/* ── Sticky summary rail ── */}
      <aside className="lg:sticky lg:top-20">
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <SaveIndicator state={saveState} />
            {/*
              How close this voucher is to being submittable, counted from the same
              blocker list the button uses. On a thirty-two field form the useful
              question is not "is it valid" but "how much is left", and a ring
              answers that from the corner of your eye while you type.
            */}
            <ReadyRing blockers={blockers} />
          </div>

          <div className="space-y-3 p-4">
            <ComputedField label="Net total" value={fmtRupees(totals.net)} />
            <p className="text-subtle text-xs">
              Grand total is Net − TDS − Advance + Tips − Discount
            </p>
          </div>

          {/*
            The figure that will be authorised, on the brand, with the app's one
            travelling highlight over it. It is the same treatment the finished
            voucher gets on its own page, so what you are building and what an
            approver will see are visibly the same object.
          */}
          <div className="gradient-brand relative overflow-hidden">
            <span aria-hidden className="a-shine absolute inset-0" />
            <div className="relative flex items-baseline justify-between gap-3 px-4 py-3.5 text-white">
              <span className="text-[10px] font-semibold tracking-[0.14em] uppercase opacity-85">
                Grand total
              </span>
              <span className="a-figure text-xl">{fmtRupees(totals.grand)}</span>
            </div>
          </div>

          {showErrors && blockers.length > 0 && (
            <div
              style={{ '--tone': 'var(--status-rejected)' } as CSSProperties}
              className="tinted animate-[rise_0.3s_cubic-bezier(0.22,1,0.36,1)] border-t p-4"
            >
              <p className="text-xs font-semibold">Before submitting:</p>
              <ul className="mt-2 space-y-1.5">
                {blockers.map((b) => (
                  <li key={b.path} className="flex gap-2 text-xs opacity-90">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                    {b.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t p-4">
            <Button
              variant="primary"
              className="w-full"
              onClick={onSubmit}
              loading={submitting}
              disabled={saveState === 'saving'}
            >
              <Send className="size-4" aria-hidden />
              Submit for approval
            </Button>
            <Button variant="ghost" className="w-full" onClick={onDelete} disabled={submitting}>
              <Trash2 className="size-4" aria-hidden />
              Delete draft
            </Button>
          </div>
        </Card>

        <nav className="mt-4 hidden lg:block" aria-label="Sections">
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-muted group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--surface-sunken)] hover:text-[var(--text-c)]"
            >
              <span className="surface-sunken text-subtle a-label grid size-5 shrink-0 place-items-center rounded-md border !text-[9px] group-hover:text-[var(--text-c)]">
                {i + 1}
              </span>
              {s.label}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}

/**
 * The five things `submitReadiness` always checks, by the path it reports them on.
 *
 * Anything it returns that is not one of these came from `crossFieldIssues` — a
 * contradiction between two fields rather than a missing one — and those are not a
 * fixed list. So the ring counts these five as its denominator and adds one to both
 * halves for each contradiction currently outstanding. That way it can read 5 of 6
 * rather than claiming 5 of 5 while the submit button refuses.
 */
const BASE_CHECKS = [
  'chapter_id',
  'paid_to',
  'type_of_supporting',
  'type_of_payment',
  'basic_value',
] as const;

/**
 * A completion ring, drawn with a conic gradient rather than an SVG arc.
 *
 * One element and no path arithmetic: the conic sweep is masked to a ring by a
 * second element sitting in the middle of it. Also means the sweep animates by
 * changing one percentage, which is why it can move on every keystroke without
 * costing anything.
 */
function ReadyRing({ blockers }: { blockers: { path: string }[] }) {
  const contradictions = blockers.filter(
    (b) => !BASE_CHECKS.includes(b.path as (typeof BASE_CHECKS)[number]),
  ).length;
  const total = BASE_CHECKS.length + contradictions;
  const done = total - blockers.length;

  const pct = Math.round((Math.max(0, Math.min(done, total)) / total) * 100);
  const complete = pct === 100;

  return (
    <span
      className="relative grid size-9 shrink-0 place-items-center rounded-full transition-[background]"
      style={{
        background: `conic-gradient(${complete ? 'var(--status-approved)' : 'var(--color-brand-500)'} ${pct}%, var(--a-track) 0)`,
      }}
      title={`${done} of ${total} things needed before this can be submitted`}
    >
      <span className="grid size-[26px] place-items-center rounded-full bg-[var(--surface-raised)]">
        {complete ? (
          <Check className="size-3.5" style={{ color: 'var(--status-approved)' }} aria-hidden />
        ) : (
          <span className="numeric text-[10px] font-bold">{done}</span>
        )}
      </span>
      <span className="sr-only">
        {done} of {total} requirements met
      </span>
    </span>
  );
}

function SectionHead({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-3.5">
      <span className="gradient-brand elev-brand grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white">
        {step}
      </span>
      <h2 className="font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const map = {
    idle: { icon: Cloud, text: 'Draft — changes save automatically', cls: 'text-[var(--text-subtle)]' },
    saving: { icon: Loader2, text: 'Saving…', cls: 'text-[var(--text-muted)]' },
    saved: { icon: Check, text: 'Saved', cls: 'text-emerald-600 dark:text-emerald-400' },
    error: { icon: CloudOff, text: 'Not saved — check your connection', cls: 'text-red-600 dark:text-red-400' },
  }[state];

  return (
    <p className={cn('flex items-center gap-2 text-xs font-medium', map.cls)} aria-live="polite">
      <map.icon className={cn('size-3.5', state === 'saving' && 'animate-spin')} aria-hidden />
      {map.text}
    </p>
  );
}
