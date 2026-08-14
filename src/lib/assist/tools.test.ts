import { describe, expect, it } from 'vitest';
import { calcGrandTotal, calcNetTotal } from '@/lib/domain/voucher';
import { TOOLS, toolByName, toolSchemas } from './tools';

/**
 * The calculators.
 *
 * These are the reason the assistant can claim its figures are right, so they
 * are tested harder than the rest of it. Three things are being checked
 * throughout: that the arithmetic is correct, that the tool agrees with the
 * application's own functions rather than reimplementing them, and that bad
 * input produces a refusal rather than a plausible number.
 *
 * The last one matters most. A tool that reads "1,00,000" as 1 and returns a
 * total is worse than one that fails, because the answer looks fine.
 */

const run = (name: string, args: Record<string, unknown>) => {
  const tool = toolByName(name);
  if (!tool) throw new Error(`No tool called ${name}`);
  return tool.run(args);
};

describe('the tool list', () => {
  it('has no two tools with the same name', () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
  });

  it('describes every tool to the model', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.parameters.type).toBe('object');
    }
  });

  it('only marks a parameter required if it is declared', () => {
    for (const tool of TOOLS) {
      for (const name of tool.parameters.required ?? []) {
        expect(Object.keys(tool.parameters.properties)).toContain(name);
      }
    }
  });

  it('sends every tool as its own object, which is the shape the API takes', () => {
    const tools = toolSchemas();

    expect(tools).toHaveLength(TOOLS.length);

    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.input_schema).toBeTruthy();
    }
  });
});

describe('voucher_total', () => {
  it('agrees with the application, rather than adding up its own way', () => {
    const voucher = {
      basic_value: 100_000,
      cgst: 9_000,
      sgst: 9_000,
      vat: 500,
      tds: 10_000,
      advance: 25_000,
      tips: 0,
      discount: 1_000,
    };

    const outcome = run('voucher_total', voucher);

    // The point of this assertion is the right-hand side. If somebody changes
    // how an advance is netted off, both move together or this fails.
    expect(outcome.data.net_total_D).toBe(calcNetTotal(voucher));
    expect(outcome.data.grand_total).toBe(calcGrandTotal(voucher));
    expect(outcome.data.net_total_D).toBe(118_500);
    expect(outcome.data.grand_total).toBe(82_500);
  });

  it('adds tips and subtracts an advance, which is the way round people expect least', () => {
    const base = run('voucher_total', { basic_value: 1_000 });
    expect(base.data.grand_total).toBe(1_000);

    expect(run('voucher_total', { basic_value: 1_000, tips: 100 }).data.grand_total).toBe(1_100);
    expect(run('voucher_total', { basic_value: 1_000, advance: 100 }).data.grand_total).toBe(900);
  });

  it('reads an Indian-grouped figure rather than reading it as one', () => {
    // parseFloat('1,00,000') is 1. A tool that did that would return a total
    // that looks perfectly reasonable and is out by a factor of a hundred thousand.
    const outcome = run('voucher_total', { basic_value: '1,00,000' });
    expect(outcome.data.net_total_D).toBe(100_000);
  });

  it('reads a figure with a rupee sign on it', () => {
    expect(run('voucher_total', { basic_value: '₹50,000.50' }).data.net_total_D).toBe(50_000.5);
  });

  it('refuses rather than guessing when the basic value is not a number', () => {
    const outcome = run('voucher_total', { basic_value: 'about a lakh' });
    expect(outcome.ok).toBe(false);
    expect(outcome.data.net_total_D).toBeUndefined();
  });

  it('warns when a voucher has both kinds of GST on it', () => {
    const outcome = run('voucher_total', { basic_value: 1_000, cgst: 90, sgst: 90, igst: 180 });
    // Answered, because somebody may be asking what it would come to, but the
    // answer says it could never be submitted.
    expect(outcome.ok).toBe(true);
    expect(String(outcome.data.warning)).toMatch(/intra-state or inter-state/);
  });

  it('says nothing about GST when only one kind is used', () => {
    expect(run('voucher_total', { basic_value: 1_000, igst: 180 }).data.warning).toBeUndefined();
  });
});

describe('gst_split', () => {
  it('halves an intra-state supply', () => {
    const outcome = run('gst_split', {
      taxable_value: 100_000,
      rate_percent: 18,
      inter_state: false,
    });

    expect(outcome.data).toMatchObject({ cgst: 9_000, sgst: 9_000, igst: 0, gross: 118_000 });
  });

  it('puts the whole thing in IGST between states', () => {
    const outcome = run('gst_split', {
      taxable_value: 100_000,
      rate_percent: 18,
      inter_state: true,
    });

    expect(outcome.data).toMatchObject({ igst: 18_000, cgst: 0, sgst: 0, gross: 118_000 });
  });

  it('gives the two halves the same figure when the total is odd', () => {
    // Splitting a rounded total instead leaves a stray paisa on one line, and
    // somebody spends an afternoon on it.
    const outcome = run('gst_split', { taxable_value: 105, rate_percent: 5, inter_state: false });
    expect(outcome.data.cgst).toBe(outcome.data.sgst);
    expect(outcome.data.cgst).toBe(2.63);
  });

  it('refuses a rate that is not a rate', () => {
    expect(run('gst_split', { taxable_value: 100, rate_percent: 180, inter_state: false }).ok).toBe(
      false,
    );
    expect(run('gst_split', { taxable_value: 100, rate_percent: -5, inter_state: false }).ok).toBe(
      false,
    );
  });

  it('refuses a missing value', () => {
    expect(run('gst_split', { rate_percent: 18, inter_state: false }).ok).toBe(false);
  });
});

describe('tds_deduction', () => {
  it('deducts at the rate this site carries', () => {
    const outcome = run('tds_deduction', { amount: 100_000, section: '194J' });
    expect(outcome.data).toMatchObject({ rate_percent: 10, tds: 10_000, net_after_tds: 90_000 });
  });

  it('always returns the caveat, because a rate on its own is misleading', () => {
    const outcome = run('tds_deduction', { amount: 1_000, section: '194C' });
    expect(String(outcome.data.caveat)).toMatch(/confirm the current position/);
  });

  it('takes a section in any case', () => {
    expect(run('tds_deduction', { amount: 1_000, section: '194j' }).ok).toBe(true);
  });

  it('refuses a section it does not carry, and says which it does', () => {
    const outcome = run('tds_deduction', { amount: 100_000, section: '194Q' });
    expect(outcome.ok).toBe(false);
    // The model is told what to do instead, so it does not invent a rate.
    expect(String(outcome.data.error)).toMatch(/194C/);
    expect(String(outcome.data.error)).toMatch(/rather than guessing/);
  });
});

describe('check_identifier', () => {
  it('accepts a well formed PAN', () => {
    expect(run('check_identifier', { pan: 'ABCDE1234F' }).data.pan_valid).toBe(true);
  });

  it('rejects a PAN of the wrong shape', () => {
    expect(run('check_identifier', { pan: 'ABCD1234F' }).data.pan_valid).toBe(false);
  });

  it('normalises case and spaces before judging', () => {
    expect(run('check_identifier', { pan: ' abcde1234f ' }).data.pan_valid).toBe(true);
  });

  it('checks the GSTIN checksum, not just its shape', () => {
    // 29ABCDE1234F1Z5 is the shape but not the check character.
    const shaped = run('check_identifier', { gstin: '29ABCDE1234F1Z5' });
    expect(shaped.data.gstin_valid).toBe(false);
    expect(String(shaped.data.gstin_expected)).toMatch(/check character/);
  });

  it('pulls the state code and the PAN out of a valid GSTIN', () => {
    const outcome = run('check_identifier', { gstin: '29AAACI1195H1ZI' });
    expect(outcome.data).toMatchObject({
      gstin_valid: true,
      gstin_state_code: '29',
      gstin_pan: 'AAACI1195H',
    });
  });

  it('says when a PAN and a GSTIN do not belong to each other', () => {
    const outcome = run('check_identifier', { gstin: '29AAACI1195H1ZI', pan: 'ABCDE1234F' });
    expect(outcome.data.pan_matches_gstin).toBe(false);
  });

  it('says when they do', () => {
    const outcome = run('check_identifier', { gstin: '29AAACI1195H1ZI', pan: 'AAACI1195H' });
    expect(outcome.data.pan_matches_gstin).toBe(true);
  });

  it('refuses when given neither', () => {
    expect(run('check_identifier', {}).ok).toBe(false);
  });
});

describe('financial_year', () => {
  it('puts March in the year that started the April before', () => {
    expect(run('financial_year', { date: '2026-03-31' }).data.financial_year).toBe('25-26');
  });

  it('starts the new year on 1 April', () => {
    expect(run('financial_year', { date: '2026-04-01' }).data.financial_year).toBe('26-27');
  });

  it('falls back to today when no date is given, and says that it did', () => {
    const outcome = run('financial_year', {});
    expect(outcome.ok).toBe(true);
    expect(outcome.data.was_given).toBe(false);
    expect(String(outcome.data.date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuses a date it cannot read', () => {
    expect(run('financial_year', { date: 'last April' }).ok).toBe(false);
    expect(run('financial_year', { date: '01/04/2026' }).ok).toBe(false);
  });
});

describe('ledger_balance', () => {
  it('closes a debit-balance ledger', () => {
    const outcome = run('ledger_balance', {
      opening: 1_000_000,
      opening_side: 'Dr',
      total_debits: 250_000,
      total_credits: 310_000,
    });

    expect(outcome.data).toMatchObject({ closing_balance: 940_000, closing_side: 'Dr' });
  });

  it('closes a credit-balance ledger without a second rule for it', () => {
    const outcome = run('ledger_balance', {
      opening: 1_000_000,
      opening_side: 'Cr',
      total_debits: 50_000,
      total_credits: 82_700,
    });

    expect(outcome.data).toMatchObject({ closing_balance: 1_032_700, closing_side: 'Cr' });
  });

  it('crosses zero and changes side', () => {
    const outcome = run('ledger_balance', {
      opening: 1_000,
      opening_side: 'Dr',
      total_debits: 0,
      total_credits: 2_500,
    });

    expect(outcome.data).toMatchObject({ closing_balance: 1_500, closing_side: 'Cr' });
  });

  it('confirms a stated closing balance that agrees', () => {
    const outcome = run('ledger_balance', {
      opening: 1_000_000,
      opening_side: 'Dr',
      total_debits: 250_000,
      total_credits: 310_000,
      stated_closing: 940_000,
      stated_closing_side: 'Dr',
    });

    expect(outcome.data.agrees_with_stated).toBe(true);
    expect(outcome.summary).toMatch(/agrees/);
  });

  it('says by how much a stated closing balance is out', () => {
    const outcome = run('ledger_balance', {
      opening: 1_000_000,
      opening_side: 'Dr',
      total_debits: 250_000,
      total_credits: 310_000,
      stated_closing: 950_000,
      stated_closing_side: 'Dr',
    });

    expect(outcome.data.agrees_with_stated).toBe(false);
    expect(outcome.data.difference).toBe(-10_000);
  });

  it('catches a stated balance on the wrong side', () => {
    const outcome = run('ledger_balance', {
      opening: 0,
      opening_side: 'Dr',
      total_debits: 100,
      total_credits: 0,
      stated_closing: 100,
      stated_closing_side: 'Cr',
    });

    expect(outcome.data.agrees_with_stated).toBe(false);
  });

  it('refuses when a total is missing', () => {
    expect(run('ledger_balance', { opening: 100, opening_side: 'Dr', total_debits: 5 }).ok).toBe(
      false,
    );
  });
});
