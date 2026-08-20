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
import { Check, Cloud, CloudOff, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PAYMENT_RULES,
  SPONSORSHIPS,
  SUPPORTING_TYPES,
  MIN_VOUCHER_DATE,
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
import { istToday } from '@/lib/fiscal';
import {
  saveDraft,
  saveVoucherNo,
  suggestVoucherNo,
  deleteDraft,
} from '@/app/actions/voucher';
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
import { Modal } from '@/components/ui/Modal';
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
  requiresApproval,
}: {
  voucher: Record<string, unknown> & { id: string; status: string };
  chapters: Chapter[];
  events: EventOption[];
  /** Off means submit pays the voucher immediately instead of queuing it (0013). */
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(voucher));
  const [eventList, setEventList] = useState(events);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  /*
   * What the server said about the voucher number specifically — a duplicate,
   * almost always. Kept apart from `saveError` so it can be shown on the field
   * that caused it rather than as a verdict on the whole form.
   */
  const [numberIssue, setNumberIssue] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const dirty = useRef(false);
  // True from a keystroke until the save carrying it returns. `dirty` only ever
  // goes true, so it cannot answer "is there anything outstanding right now".
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Computed once per mount — good enough for a date picker's `max`, and for
  // the FY-boundary check submitReadiness runs against the same value.
  const [today] = useState(() => istToday());

  const set = useCallback((key: string, value: string) => {
    dirty.current = true;
    pending.current = true;
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
  const blockers = useMemo(() => submitReadiness(form, today), [form, today]);
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
    pending.current = false;

    /*
     * Two statements, not one, and the voucher number goes in the second.
     *
     * A unique index covers (organization_id, voucher_no). While the typed
     * number collides with an existing voucher the UPDATE carrying it fails —
     * and when it carried every other column too, that meant nothing at all
     * was being saved while the reader kept typing, with the rail blaming
     * their connection for it. Split, a collision costs the number field and
     * nothing else.
     */
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
    setSaveError(res.ok ? '' : res.error);
    if (!res.ok) toast.error(res.error);

    const numberRes = await saveVoucherNo(voucher.id, snapshot.voucher_no ?? '');
    setNumberIssue(numberRes.ok ? '' : numberRes.error);
  }, [voucher.id]);

  // Always the freshest state, for the flush on unmount below — which cannot
  // read `form` from a closure without capturing whatever it was at mount.
  // Written in an effect rather than during render: a ref mutated while
  // rendering is torn under concurrent rendering, and React lints for it.
  const latest = useRef(form);
  useEffect(() => {
    latest.current = form;
  }, [form]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    // setState happens inside the timer callback, never synchronously here.
    timer.current = setTimeout(() => void persist(form), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [form, persist]);

  /*
   * Flush on the way out.
   *
   * The debounce effect above clears its timer on cleanup, and that cleanup
   * also runs when the component unmounts — so clicking "Back to vouchers"
   * threw away up to 900ms of typing, silently, on the most ordinary
   * navigation in the app. This effect has no reactive dependency on `form`,
   * so its cleanup runs once, on unmount, and saves what the timer would have.
   */
  useEffect(
    () => () => {
      if (pending.current) void persist(latest.current);
    },
    [persist],
  );

  /*
   * And on the way off the page entirely. A server action started here is not
   * guaranteed to finish, which is why the browser is also asked to confirm —
   * but only while something really is unsaved, so the prompt cannot appear on
   * a form that is up to date.
   */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current) return;
      if (timer.current) clearTimeout(timer.current);
      void persist(latest.current);
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [persist]);

  // ─── Dependent-field rules ─────────────────────────────────────────────────

  /** Choosing a supporting type resets the payment: auto for the fixed ones. */
  const pickSupporting = (value: SupportingType) => {
    dirty.current = true;
    pending.current = true;
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
    pending.current = true;
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
        toast.success(
          requiresApproval
            ? `${res.data.voucherNo} submitted for approval.`
            : `${res.data.voucherNo} recorded as paid.`,
        );
        router.push(`/vouchers/${voucher.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  const onDelete = () => {
    setConfirmDelete(false);
    startSubmit(async () => {
      const res = await deleteDraft(voucher.id);
      if (res.ok) {
        // Names where it went. It is recoverable from Admin → Deleted, and a
        // bare "Draft deleted." left somebody who misclicked believing the
        // work was gone.
        toast.success('Draft deleted. An admin can restore it from Admin → Deleted.');
        router.push('/vouchers');
      } else toast.error(res.error);
    });
  };

  /*
   * Offer the next number for the chosen chapter.
   *
   * Only ever fills a blank field, and only on request — the number stays the
   * reader's to type or change. Without this the form asked somebody to invent
   * FI/HO/26-27/0001 from an example of a number belonging to a different
   * chapter, with no way to know the code, the year format, or the sequence.
   */
  const [suggesting, setSuggesting] = useState(false);
  const suggest = async () => {
    if (!form.chapter_id) {
      toast.error('Choose the chapter first — the number is built from its code.');
      return;
    }
    setSuggesting(true);
    const res = await suggestVoucherNo(form.chapter_id, form.date || null);
    setSuggesting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    set('voucher_no', res.data.voucherNo);
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
            <Field label="Voucher date" htmlFor="f-date" required error={errorFor('date')}>
              <Input
                id="f-date"
                type="date"
                min={MIN_VOUCHER_DATE}
                max={today}
                value={form.date ?? ''}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>

            <Field
              label="Chapter"
              htmlFor="f-chapter_id"
              required
              error={errorFor('chapter_id')}
              /*
               * With no chapters at all this select held nothing but its own
               * placeholder, on a required field, with nothing saying why — the
               * point where a new organisation's first voucher stopped dead.
               * 0021 seeds a head office so it should never be empty again;
               * this says what to do if it somehow is.
               */
              hint={chapters.length === 0 ? 'No chapters yet — add one in Admin → Chapters.' : undefined}
            >
              <Select
                id="f-chapter_id"
                value={form.chapter_id ?? ''}
                onChange={(e) => pickChapter(e.target.value)}
                disabled={chapters.length === 0}
              >
                <option value="">
                  {chapters.length === 0 ? 'No chapters available' : 'Select chapter'}
                </option>
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
              htmlFor="f-voucher_no"
              required
              /*
               * A duplicate is reported here, on the field that caused it,
               * rather than only as a toast that expires while the rail claims
               * the connection is at fault.
               */
              error={numberIssue || errorFor('voucher_no')}
              hint="Typed by hand. Use the suggestion for the next number in this chapter's run."
              action={
                <button
                  type="button"
                  onClick={suggest}
                  disabled={suggesting}
                  className="text-muted inline-flex items-center gap-1 rounded text-xs font-medium transition hover:text-[var(--text-c)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)] focus-visible:outline-none disabled:opacity-60"
                >
                  {suggesting ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3" aria-hidden />
                  )}
                  Suggest
                </button>
              }
            >
              <Input
                id="f-voucher_no"
                className="numeric"
                value={form.voucher_no ?? ''}
                onChange={(e) => set('voucher_no', e.target.value)}
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
              <Field
                label="Event date"
                htmlFor="f-event_date"
                hint="Filled from the event; override if needed."
                error={errorFor('event_date')}
              >
                <Input
                  id="f-event_date"
                  type="date"
                  min={MIN_VOUCHER_DATE}
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
                {/* Required, and marked — it is a hard submit gate that carried
                    no asterisk, and whose error was the one required-field
                    message that never rendered anywhere near its field. */}
                <p className="mb-2 text-sm font-medium">
                  Type of payment <span className="text-red-500" aria-label="required">*</span>
                </p>
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
                {errorFor('type_of_payment') && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                    {errorFor('type_of_payment')}
                  </p>
                )}
              </div>
            )}

            {/*
              The three invoice dates, with the order between them stated once.
              Each carries an id and an htmlFor now: they render errors that name
              a field, and without an id `scrollIntoView` had nothing to find, so
              the reader got a message about a field the page would not move to —
              and the labels were not tied to their inputs for a screen reader.
            */}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Invoice number" htmlFor="f-invoice_no">
                <Input
                  id="f-invoice_no"
                  value={form.invoice_no ?? ''}
                  onChange={(e) => set('invoice_no', e.target.value)}
                />
              </Field>
              <Field
                label="Invoice date"
                htmlFor="f-invoice_date"
                hint="The voucher and received dates must be on or after this."
                error={errorFor('invoice_date')}
              >
                <Input
                  id="f-invoice_date"
                  type="date"
                  min={MIN_VOUCHER_DATE}
                  value={form.invoice_date ?? ''}
                  onChange={(e) => set('invoice_date', e.target.value)}
                />
              </Field>
              <Field
                label="Invoice received date"
                htmlFor="f-invoice_received_date"
                hint="When it reached you."
                error={errorFor('invoice_received_date')}
              >
                <Input
                  id="f-invoice_received_date"
                  type="date"
                  min={MIN_VOUCHER_DATE}
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
              <Field
                label="Basic value (A)"
                htmlFor="f-basic_value"
                required
                error={errorFor('basic_value')}
              >
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
                min={MIN_VOUCHER_DATE}
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
            {requiresApproval
              ? 'You no longer type approver names. When you submit, this voucher enters the approval queue and records who approves it — never you.'
              : 'This organisation does not require approval. When you submit, this voucher is paid immediately.'}
          </p>
        </Card>
      </div>

      {/* ── Sticky summary rail ── */}
      <aside className="lg:sticky lg:top-20">
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b p-4">
            <SaveIndicator state={saveState} message={saveError} />
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
              {requiresApproval ? 'Submit for approval' : 'Submit & pay'}
            </Button>
            {/*
              Asks first. This fired immediately, directly beneath Submit, at
              the same width, and stayed on screen while the page scrolled —
              the only destructive action in the app that did not use a modal.
            */}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
            >
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

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this draft?"
        description="It leaves your list straight away. An admin can restore it from Admin → Deleted if this was a mistake."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onDelete} loading={submitting}>
            <Trash2 className="size-4" aria-hidden />
            Delete draft
          </Button>
        </div>
      </Modal>
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
  'voucher_no',
  'basic_value',
  // The voucher date is required too. It was missing from this list while
  // submitReadiness only validated a date that existed, so clearing the
  // pre-filled one left the ring showing a complete tick over a form the
  // database would refuse.
  'date',
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

/**
 * `message` is the server's own reason for a failed save.
 *
 * This used to read "Not saved — check your connection" for every failure,
 * including a rejected value and a locked voucher — so the one persistent piece
 * of status on the page confidently blamed the network for things the network
 * had nothing to do with. The real reason was in a toast, which expires.
 */
function SaveIndicator({
  state,
  message,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  message?: string;
}) {
  const map = {
    idle: { icon: Cloud, text: 'Draft — changes save automatically', cls: 'text-[var(--text-subtle)]' },
    saving: { icon: Loader2, text: 'Saving…', cls: 'text-[var(--text-muted)]' },
    saved: { icon: Check, text: 'Saved', cls: 'text-emerald-600 dark:text-emerald-400' },
    error: {
      icon: CloudOff,
      text: message || 'Not saved. Your last change may not have been kept.',
      cls: 'text-red-600 dark:text-red-400',
    },
  }[state];

  return (
    <p className={cn('flex items-start gap-2 text-xs font-medium', map.cls)} aria-live="polite">
      <map.icon
        className={cn('mt-px size-3.5 shrink-0', state === 'saving' && 'animate-spin')}
        aria-hidden
      />
      {map.text}
    </p>
  );
}
