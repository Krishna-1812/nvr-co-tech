import {
  calcGrandTotal,
  calcNetTotal,
  calcTax,
  fmtRupees,
  gstMode,
  gstinMatchesPan,
  isValidGstin,
  isValidPan,
} from '@/lib/domain/voucher';
import { fiscalYear, istToday } from '@/lib/fiscal';
import { TDS_SECTIONS } from '@/lib/marketing/content';

/**
 * The arithmetic, taken away from the model.
 *
 * This is the part of "accurate" that can actually be guaranteed. A language
 * model asked to add up a voucher will nearly always get it right and will
 * occasionally not, and there is no way to tell which from the answer, because
 * both come out in the same confident sentence. So it is not asked. It is given
 * these functions instead, and every figure in an answer comes back through one
 * of them.
 *
 * The important property is that these are not a second implementation written
 * for the assistant. `calcGrandTotal` here is the same `calcGrandTotal` the
 * voucher form uses and the database mirrors as a generated column. If somebody
 * changes how an advance is netted off, the assistant changes with it, and the
 * existing voucher tests are what protect both.
 *
 * Where there was no existing function, the tool does the smallest possible
 * arithmetic and shows its working in the summary, so a wrong answer is visible
 * rather than deduced.
 */

export type ToolOutcome = {
  ok: boolean;
  /** One sentence for the reader, shown under the answer. */
  summary: string;
  /** What goes back to the model. Kept small and flat. */
  data: Record<string, unknown>;
};

/**
 * The parameter schema, in the subset Gemini accepts.
 *
 * It looks like JSON Schema and is not. Gemini takes an OpenAPI-flavoured
 * subset, and anything outside it is a hard 400 rather than an ignored field:
 * `additionalProperties: false`, which every JSON Schema in this codebase would
 * ordinarily carry, is rejected by name. That is not a thing the documentation
 * makes obvious and it is not a thing you find without sending one.
 *
 * So the type is written down as the subset. `toolSchemas` has a test that
 * walks what is actually sent and fails on any key outside it, because the next
 * person to add a tool will reach for the JSON Schema they know.
 */
type Schema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export type AssistTool = {
  name: string;
  /** What the trace calls it. Written for a reader, not for the model. */
  label: string;
  description: string;
  parameters: Schema;
  run: (args: Record<string, unknown>) => ToolOutcome;
};

// ─── Reading what the model sent ─────────────────────────────────────────────

/**
 * A number, from whatever the model put in the field.
 *
 * It is told to send numbers and it usually does, but a question containing
 * "1,00,000" comes back as that string often enough to matter, and the domain
 * layer's own `toNum` would read it as 1: parseFloat stops at the first comma
 * and returns a plausible, wrong answer. So this one strips grouping and
 * currency first, and returns null rather than zero when it still cannot read
 * the value. Nothing here treats a missing figure as a zero figure by accident.
 */
function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[₹$£€,\s]/g, '');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Same, but a missing field is genuinely zero. Used for the optional amount lines. */
const zero = (value: unknown): number => num(value) ?? 0;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Two decimal places, the way money rounds. */
const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── The tools ───────────────────────────────────────────────────────────────

const voucherTotal: AssistTool = {
  name: 'voucher_total',
  label: 'Voucher total',
  description:
    'Work out the net total and grand total of a payment voucher from its amount lines, ' +
    'using the exact formulas this application uses. Call this whenever a voucher total is ' +
    'asked for or implied. Never add these figures up yourself.',
  parameters: {
    type: 'object',
    properties: {
      basic_value: { type: 'number', description: 'Line A, the value before tax.' },
      cgst: { type: 'number', description: 'Central GST. Use with sgst, never with igst.' },
      sgst: { type: 'number', description: 'State GST. Use with cgst, never with igst.' },
      igst: { type: 'number', description: 'Integrated GST. Never with cgst or sgst.' },
      vat: { type: 'number', description: 'Line C, VAT or other charges.' },
      tds: { type: 'number', description: 'Line E, tax deducted at source.' },
      advance: { type: 'number', description: 'Line G, an advance already paid. Subtracts.' },
      tips: { type: 'number', description: 'Line H. Adds.' },
      discount: { type: 'number', description: 'Line I. Subtracts.' },
    },
    required: ['basic_value'],
  },
  run(args) {
    const basic = num(args.basic_value);
    if (basic === null) {
      return { ok: false, summary: 'No basic value was given.', data: { error: 'basic_value is required and must be a number' } };
    }

    const v = {
      basic_value: basic,
      cgst: zero(args.cgst),
      sgst: zero(args.sgst),
      igst: zero(args.igst),
      vat: zero(args.vat),
      tds: zero(args.tds),
      advance: zero(args.advance),
      tips: zero(args.tips),
      discount: zero(args.discount),
    };

    /*
     * The exclusivity rule is reported, not enforced. A voucher carrying both
     * would be refused by the form and by a check constraint, but somebody may
     * legitimately be asking the assistant what such a voucher would come to,
     * and refusing to answer would be less useful than answering and saying it
     * could not be submitted.
     */
    const mode = gstMode(v);
    const bothSides = mode.usingCgstSgst && mode.usingIgst;

    const tax = money(calcTax(v));
    const net = money(calcNetTotal(v));
    const grand = money(calcGrandTotal(v));

    return {
      ok: true,
      summary: `Net total ${fmtRupees(net)}, grand total ${fmtRupees(grand)}.`,
      data: {
        total_tax_B: tax,
        net_total_D: net,
        grand_total: grand,
        formula: 'D = A + B + C. Grand total = D - TDS - advance + tips - discount.',
        ...(bothSides
          ? {
              warning:
                'This voucher has CGST or SGST together with IGST. That combination cannot be submitted: a supply is either intra-state or inter-state.',
            }
          : {}),
      },
    };
  },
};

const gstSplit: AssistTool = {
  name: 'gst_split',
  label: 'GST split',
  description:
    'Split a GST amount into CGST and SGST for an intra-state supply, or into IGST for an ' +
    'inter-state one. Call this rather than working out a percentage yourself.',
  parameters: {
    type: 'object',
    properties: {
      taxable_value: { type: 'number', description: 'The value the rate applies to.' },
      rate_percent: { type: 'number', description: 'The total GST rate, for example 18.' },
      inter_state: {
        type: 'boolean',
        description:
          'True when the supplier and the place of supply are in different states, which means IGST.',
      },
    },
    required: ['taxable_value', 'rate_percent', 'inter_state'],
  },
  run(args) {
    const value = num(args.taxable_value);
    const rate = num(args.rate_percent);
    if (value === null || rate === null) {
      return { ok: false, summary: 'A value and a rate are both needed.', data: { error: 'taxable_value and rate_percent must be numbers' } };
    }
    if (rate < 0 || rate > 100) {
      return { ok: false, summary: `${rate}% is not a rate.`, data: { error: 'rate_percent must be between 0 and 100' } };
    }

    const interState = args.inter_state === true || args.inter_state === 'true';
    const total = money((value * rate) / 100);

    /*
     * The halves are each rounded from the full amount rather than being derived
     * from the rounded total, so CGST equals SGST exactly. Splitting a rounded
     * total instead leaves a stray paisa on one of the two lines whenever the
     * total is odd, and a voucher where the two halves differ by a paisa is the
     * sort of thing somebody spends an afternoon on.
     */
    const half = money((value * rate) / 200);

    return {
      ok: true,
      summary: interState
        ? `IGST ${fmtRupees(total)} on ${fmtRupees(value)} at ${rate}%.`
        : `CGST ${fmtRupees(half)} and SGST ${fmtRupees(half)} on ${fmtRupees(value)} at ${rate}%.`,
      data: interState
        ? { igst: total, cgst: 0, sgst: 0, total_tax: total, gross: money(value + total) }
        : {
            cgst: half,
            sgst: half,
            igst: 0,
            total_tax: money(half * 2),
            gross: money(value + half * 2),
          },
    };
  },
};

const tdsDeduction: AssistTool = {
  name: 'tds_deduction',
  label: 'TDS deduction',
  description:
    'Work out a TDS deduction for one of the four sections this site carries: 194C, 194H or ' +
    '194J. The result includes a caveat about the rate that must be passed on to the reader.',
  parameters: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'The amount the deduction applies to.' },
      section: {
        type: 'string',
        enum: TDS_SECTIONS.filter((s) => s.code !== 'None').map((s) => s.code),
        description: 'The section code.',
      },
    },
    required: ['amount', 'section'],
  },
  run(args) {
    const amount = num(args.amount);
    const code = str(args.section)?.toUpperCase();
    if (amount === null) {
      return { ok: false, summary: 'No amount was given.', data: { error: 'amount must be a number' } };
    }

    const section = TDS_SECTIONS.find((s) => s.code.toUpperCase() === code);
    if (!section || section.code === 'None') {
      return {
        ok: false,
        summary: `This site does not carry section ${code ?? 'that'}.`,
        data: {
          error: `Unknown section. This site carries only ${TDS_SECTIONS.filter((s) => s.code !== 'None').map((s) => s.code).join(', ')}. Tell the reader to check the rate for their section rather than guessing one.`,
        },
      };
    }

    const tds = money((amount * section.rate) / 100);

    return {
      ok: true,
      summary: `${section.code} at ${section.rate}% on ${fmtRupees(amount)} is ${fmtRupees(tds)}.`,
      data: {
        section: section.code,
        rate_percent: section.rate,
        tds: tds,
        net_after_tds: money(amount - tds),
        note: section.note,
        caveat:
          'This is the rate behind the calculator on this site, for the ordinary case. Rates change, and a higher rate applies where the PAN is missing or inoperative. Tell the reader to confirm the current position for their own case.',
      },
    };
  },
};

const checkIdentifier: AssistTool = {
  name: 'check_identifier',
  label: 'PAN and GSTIN check',
  description:
    'Check whether a PAN or a GSTIN is well formed, including the GSTIN checksum, and whether ' +
    'a PAN and GSTIN given together belong to each other. Use this rather than eyeballing the ' +
    'pattern.',
  parameters: {
    type: 'object',
    properties: {
      pan: { type: 'string', description: 'A PAN, for example ABCDE1234F.' },
      gstin: { type: 'string', description: 'A GSTIN, fifteen characters.' },
    },
  },
  run(args) {
    // Case and stray spaces are a transcription artefact, not the reader being
    // wrong, so they are normalised away before anything is judged.
    const pan = str(args.pan)?.toUpperCase().replace(/\s/g, '') ?? null;
    const gstin = str(args.gstin)?.toUpperCase().replace(/\s/g, '') ?? null;

    if (!pan && !gstin) {
      return { ok: false, summary: 'Nothing to check.', data: { error: 'Give a pan, a gstin, or both' } };
    }

    const data: Record<string, unknown> = {};
    const said: string[] = [];

    if (pan) {
      const ok = isValidPan(pan);
      data.pan = pan;
      data.pan_valid = ok;
      said.push(ok ? `PAN ${pan} is well formed.` : `PAN ${pan} is not well formed.`);
      if (!ok) data.pan_expected = 'Five letters, four digits, one letter.';
    }

    if (gstin) {
      const ok = isValidGstin(gstin);
      data.gstin = gstin;
      data.gstin_valid = ok;
      if (ok) {
        data.gstin_state_code = gstin.slice(0, 2);
        data.gstin_pan = gstin.slice(2, 12);
      } else {
        data.gstin_expected =
          'Fifteen characters: two state digits, a ten-character PAN, an entity digit, Z, and a check character. The check character is calculated from the other fourteen, so a well-shaped GSTIN can still fail it.';
      }
      said.push(ok ? `GSTIN ${gstin} is well formed.` : `GSTIN ${gstin} is not well formed.`);
    }

    if (pan && gstin) {
      const matches = gstinMatchesPan(gstin, pan);
      data.pan_matches_gstin = matches;
      said.push(matches ? 'They belong to each other.' : 'They do not belong to each other.');
    }

    data.caveat =
      'Well formed is not the same as registered or active. Tell the reader to look the number up if that matters.';

    return { ok: true, summary: said.join(' '), data };
  },
};

const financialYearTool: AssistTool = {
  name: 'financial_year',
  label: 'Financial year',
  description:
    'Which Indian financial year a date falls in, and how much of it is left. Call this for ' +
    'anything involving the current year, because you do not know what today is.',
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'A date as yyyy-mm-dd. Leave it out for today in India.',
      },
    },
  },
  run(args) {
    const given = str(args.date);
    // Today is resolved in Asia/Kolkata, not in the server's timezone. Between
    // half six in the evening and midnight IST the two are different days.
    const date = given ?? istToday();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        ok: false,
        summary: `"${date}" is not a date.`,
        data: { error: 'date must be yyyy-mm-dd' },
      };
    }

    const fiscal = fiscalYear(date);

    return {
      ok: true,
      summary: `${date} is in FY ${fiscal.label}.`,
      data: {
        date,
        was_given: given !== null,
        financial_year: fiscal.label,
        runs: '1 April to 31 March',
        percent_elapsed: fiscal.progress,
        days_left: fiscal.daysLeft,
      },
    };
  },
};

const ledgerBalance: AssistTool = {
  name: 'ledger_balance',
  label: 'Ledger balance',
  description:
    'Close off a ledger from its opening balance and its totals, in the same signed space the ' +
    'reconciliation engine uses. Use it for any closing balance question, and for checking ' +
    'whether a stated closing balance is right.',
  parameters: {
    type: 'object',
    properties: {
      opening: { type: 'number', description: 'The opening balance, as an unsigned figure.' },
      opening_side: { type: 'string', enum: ['Dr', 'Cr'], description: 'Which side it is on.' },
      total_debits: { type: 'number' },
      total_credits: { type: 'number' },
      stated_closing: {
        type: 'number',
        description: 'Optional. A closing balance printed on the ledger, to be checked.',
      },
      stated_closing_side: { type: 'string', enum: ['Dr', 'Cr'] },
    },
    required: ['opening', 'opening_side', 'total_debits', 'total_credits'],
  },
  run(args) {
    const opening = num(args.opening);
    const debits = num(args.total_debits);
    const credits = num(args.total_credits);
    const side = str(args.opening_side)?.toLowerCase().startsWith('c') ? 'Cr' : 'Dr';

    if (opening === null || debits === null || credits === null) {
      return {
        ok: false,
        summary: 'An opening balance and both totals are needed.',
        data: { error: 'opening, total_debits and total_credits must all be numbers' },
      };
    }

    // One signed space, debit positive. The whole point is that there is no
    // second rule for a credit-balance ledger: the sign carries it.
    const signed = (side === 'Cr' ? -Math.abs(opening) : Math.abs(opening)) + debits - credits;
    const closingSide = signed < 0 ? 'Cr' : 'Dr';
    const closing = money(Math.abs(signed));

    const data: Record<string, unknown> = {
      closing_balance: closing,
      closing_side: closingSide,
      signed_closing: money(signed),
      working: `${side === 'Cr' ? '-' : '+'}${Math.abs(opening)} + ${debits} - ${credits} = ${money(signed)} (debit positive)`,
    };

    let summary = `Closing balance ${fmtRupees(closing)} ${closingSide}.`;

    const stated = num(args.stated_closing);
    if (stated !== null) {
      const statedSide = str(args.stated_closing_side)?.toLowerCase().startsWith('c') ? 'Cr' : 'Dr';
      const statedSigned = statedSide === 'Cr' ? -Math.abs(stated) : Math.abs(stated);
      const difference = money(signed - statedSigned);
      const agrees = Math.abs(difference) < 0.01;

      data.stated_closing = money(Math.abs(stated));
      data.stated_closing_side = statedSide;
      data.agrees_with_stated = agrees;
      data.difference = difference;

      summary += agrees
        ? ' That agrees with the stated closing balance.'
        : ` The stated closing balance is out by ${fmtRupees(Math.abs(difference))}.`;
    }

    return { ok: true, summary, data };
  },
};

export const TOOLS: AssistTool[] = [
  voucherTotal,
  gstSplit,
  tdsDeduction,
  checkIdentifier,
  financialYearTool,
  ledgerBalance,
];

export function toolByName(name: string): AssistTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * The tool list, in the one shape Gemini takes.
 *
 * All six go in a single `tools` entry rather than one entry each. That is what
 * the API expects, and sending six entries is accepted but reportedly makes the
 * model worse at choosing between them.
 *
 * Note what is NOT here. There is no strict mode and no way to ask for one, so
 * every argument is checked in `run` regardless of what the model sent. That is
 * where it has to happen anyway: a schema stops a field being the wrong type, it
 * does not stop a plausible number being the wrong number.
 */
export function toolSchemas() {
  return [
    {
      functionDeclarations: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}
