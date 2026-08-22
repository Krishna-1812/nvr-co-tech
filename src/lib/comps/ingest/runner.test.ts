import { describe, expect, it } from 'vitest';
import { NSE } from '../sources';
import type { CompanyRecord, Harvest } from '../sources/types';
import { emptyHarvest } from '../sources/types';
import {
  keysOf,
  matchKey,
  messageOf,
  pace,
  runBatched,
  runPaced,
  skipLines,
  summarise,
  writeHarvest,
} from './runner';
import { MemoryWriter } from './writers';
import type { Clock } from './types';

/** A clock that never waits, and records what it was asked to wait for. */
function fakeClock(): Clock & { slept: number[]; tick(ms: number): void } {
  let t = 0;
  const slept: number[] = [];
  return {
    slept,
    tick: (ms: number) => {
      t += ms;
    },
    now: () => t,
    sleep: async (ms: number) => {
      slept.push(ms);
      t += ms;
    },
  };
}

function company(over: Partial<CompanyRecord> = {}): CompanyRecord {
  return { name: 'Example Ltd', nse_symbol: 'EXAMPLE', source: 'nse', ...over };
}

function harvest(over: Partial<Harvest> = {}): Harvest {
  return { ...emptyHarvest(), ...over };
}

describe('matchKey and keysOf', () => {
  it('is case-insensitive on the value, since these are identifiers', () => {
    expect(matchKey({ by: 'nse_symbol', value: 'example' })).toBe('nse_symbol:EXAMPLE');
  });

  it('indexes every identifier a company carries, not just the primary one', () => {
    // So a quote keyed on an ISIN resolves against a company written keyed on a
    // symbol, without a round trip and without either source knowing the other.
    expect(keysOf({ cin: 'U1', nse_symbol: 'ex', isin: 'INE1' })).toEqual([
      'cin:U1',
      'nse_symbol:EX',
      'isin:INE1',
    ]);
  });

  it('emits nothing for a company with no identifiers', () => {
    expect(keysOf({})).toEqual([]);
  });
});

describe('writeHarvest', () => {
  it('writes companies before the figures that point at them', async () => {
    const writer = new MemoryWriter();
    const result = await writeHarvest(
      harvest({
        companies: [company()],
        quotes: [
          {
            match: { by: 'nse_symbol', value: 'EXAMPLE' },
            as_of: '2026-08-22',
            market_cap: 1_000,
            currency: 'INR',
            source: 'nse',
          },
        ],
      }),
      writer,
      new Map(),
    );

    expect(result).toMatchObject({ companies: 1, quotes: 1 });
    expect(writer.quotes[0].companyId).toBe('mem-EXAMPLE');
  });

  it('does not let one company failing to upsert abandon the rest of the batch', async () => {
    // A bulk MCA batch can carry hundreds of companies in one harvest, unlike
    // NSE or EDGAR which never carry more than one. Company 2 throwing must
    // not cost company 3 its write.
    const writer = new MemoryWriter();
    const failing = {
      ...writer,
      recordFinancials: writer.recordFinancials.bind(writer),
      recordQuote: writer.recordQuote.bind(writer),
      resolve: writer.resolve.bind(writer),
      recordLookup: writer.recordLookup.bind(writer),
      async upsertCompany(record: CompanyRecord) {
        if (record.cin === 'BAD') throw new Error('constraint violation');
        return writer.upsertCompany(record);
      },
    };

    const result = await writeHarvest(
      harvest({
        companies: [
          company({ cin: 'U1', name: 'First' }),
          company({ cin: 'BAD', name: 'Second' }),
          company({ cin: 'U3', name: 'Third' }),
        ],
      }),
      failing,
      new Map(),
    );

    expect(result.companies).toBe(2);
    expect(writer.companies.map((c) => c.name)).toEqual(['First', 'Third']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toEqual({ at: 'BAD', reason: 'Threw: constraint violation' });
  });

  it('resolves a figure against the registry when it was not written this run', async () => {
    const writer = new MemoryWriter(new Map([['cik:320193', 'existing-id']]));
    const result = await writeHarvest(
      harvest({
        financials: [
          {
            match: { by: 'cik', value: '320193' },
            period_end: '2026-03-31',
            basis: 'consolidated',
            currency: 'USD',
            source: 'sec_edgar',
          },
        ],
      }),
      writer,
      new Map(),
    );

    expect(result.financials).toBe(1);
    expect(writer.financials[0].companyId).toBe('existing-id');
  });

  it('skips a figure whose company cannot be resolved, and never invents one', async () => {
    /*
     * The rule that matters here. `upsert_company` requires a name and a balance
     * sheet does not carry one, so a company invented out of a set of figures
     * would sit in the registry forever matching nothing.
     */
    const writer = new MemoryWriter();
    const result = await writeHarvest(
      harvest({
        financials: [
          {
            match: { by: 'cik', value: '999' },
            period_end: '2026-03-31',
            basis: 'consolidated',
            currency: 'USD',
            source: 'sec_edgar',
          },
        ],
      }),
      writer,
      new Map(),
    );

    expect(result.financials).toBe(0);
    expect(writer.companies).toEqual([]);
    expect(result.skipped[0].reason).toContain('No company in the registry with cik 999');
  });

  it('carries the adapter own skips through, rather than replacing them', async () => {
    const result = await writeHarvest(
      harvest({ skipped: [{ at: 'X', reason: 'No market capitalisation found' }] }),
      new MemoryWriter(),
      new Map(),
    );
    expect(result.skipped).toHaveLength(1);
  });

  it('caches a resolution so the database is asked once per identifier', async () => {
    let asked = 0;
    const writer = new MemoryWriter();
    const counting = {
      ...writer,
      upsertCompany: writer.upsertCompany.bind(writer),
      recordFinancials: writer.recordFinancials.bind(writer),
      recordQuote: writer.recordQuote.bind(writer),
      recordLookup: writer.recordLookup.bind(writer),
      resolve: async () => {
        asked += 1;
        return 'found';
      },
    };

    const known = new Map<string, string>();
    const fin = {
      match: { by: 'cik', value: '1' } as const,
      period_end: '2026-03-31',
      basis: 'consolidated' as const,
      currency: 'USD',
      source: 'sec_edgar' as const,
    };

    await writeHarvest(harvest({ financials: [fin] }), counting, known);
    await writeHarvest(harvest({ financials: [fin] }), counting, known);

    expect(asked).toBe(1);
  });

  it('does not re-ask for a company it failed to resolve, either', async () => {
    // A miss is cached as a skip per row but the lookup itself is not retried
    // within the same harvest — the second row gets its own skip line, which is
    // what a reader needs, without a second round trip.
    const writer = new MemoryWriter();
    const result = await writeHarvest(
      harvest({
        quotes: [
          { match: { by: 'cik', value: '9' }, as_of: '2026-01-01', currency: 'USD', source: 'sec_edgar' },
          { match: { by: 'cik', value: '9' }, as_of: '2026-01-02', currency: 'USD', source: 'sec_edgar' },
        ],
      }),
      writer,
      new Map(),
    );
    expect(result.skipped).toHaveLength(2);
  });
});

describe('pace', () => {
  it('does not wait before the first request', async () => {
    const clock = fakeClock();
    expect(await pace(NSE, clock, null)).toBe(0);
    expect(clock.slept).toEqual([]);
  });

  it('waits out the remainder of the gap, not the whole gap', async () => {
    // NSE is 3/s, so 334ms. If 100ms of that was spent parsing, only 234 is
    // owed — sleeping the full interval afterwards would roughly halve the
    // throughput for no benefit to the source.
    const clock = fakeClock();
    const startedAt = clock.now();
    clock.tick(100);
    expect(await pace(NSE, clock, startedAt)).toBe(234);
    expect(clock.slept).toEqual([234]);
  });

  it('does not wait at all when the work already took longer than the gap', async () => {
    const clock = fakeClock();
    const startedAt = clock.now();
    clock.tick(5_000);
    expect(await pace(NSE, clock, startedAt)).toBe(0);
    expect(clock.slept).toEqual([]);
  });
});

describe('runPaced', () => {
  const label = (s: string) => s;

  it('paces between items and reports how long it waited', async () => {
    const clock = fakeClock();
    const report = await runPaced(
      NSE,
      ['A', 'B', 'C'],
      async () => harvest({ companies: [company()] }),
      label,
      { writer: new MemoryWriter(), clock },
    );

    // Two gaps for three items, at 334ms each.
    expect(clock.slept).toEqual([334, 334]);
    expect(report.pausedMs).toBe(668);
    expect(report.requests).toBe(3);
    expect(report.requested).toBe(3);
  });

  it('counts what was written', async () => {
    const report = await runPaced(
      NSE,
      ['A', 'B'],
      async (s) =>
        harvest({
          companies: [company({ nse_symbol: s })],
          quotes: [
            {
              match: { by: 'nse_symbol', value: s },
              as_of: '2026-08-22',
              market_cap: 1,
              currency: 'INR',
              source: 'nse',
            },
          ],
        }),
      label,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );

    expect(report.companiesWritten).toBe(2);
    expect(report.quotesWritten).toBe(2);
  });

  it('turns a throw into a counted failure and carries on', async () => {
    const report = await runPaced(
      NSE,
      ['good', 'bad', 'good'],
      async (s) => {
        if (s === 'bad') throw new Error('endpoint moved');
        return harvest({ companies: [company({ nse_symbol: s })] });
      },
      label,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );

    expect(report.failed).toBe(1);
    expect(report.companiesWritten).toBe(2);
    expect(report.skipped.some((s) => s.reason === 'Threw: endpoint moved')).toBe(true);
  });

  it('stops once a source has started refusing everything', async () => {
    /*
     * A stale cookie or a blocked address refuses the next thousand requests
     * exactly as fast as the first. Grinding through them at three a second
     * looks like progress for an hour.
     */
    const report = await runPaced(
      NSE,
      Array.from({ length: 100 }, (_, i) => `S${i}`),
      async () => {
        throw new Error('refused');
      },
      label,
      { writer: new MemoryWriter(), clock: fakeClock(), stopAfterConsecutiveFailures: 5 },
    );

    expect(report.failed).toBe(5);
    expect(report.requests).toBe(5);
    expect(report.skipped.at(-1)?.reason).toContain('95 items not attempted');
  });

  it('resets the failure streak on a success, so intermittent errors do not stop a run', async () => {
    let n = 0;
    const report = await runPaced(
      NSE,
      Array.from({ length: 9 }, (_, i) => `S${i}`),
      async () => {
        n += 1;
        if (n % 3 !== 0) throw new Error('flaky');
        return harvest({ companies: [company()] });
      },
      label,
      { writer: new MemoryWriter(), clock: fakeClock(), stopAfterConsecutiveFailures: 3 },
    );

    expect(report.requests).toBe(9);
    expect(report.companiesWritten).toBe(3);
  });

  it('never stops when the limit is zero', async () => {
    const report = await runPaced(
      NSE,
      ['a', 'b', 'c'],
      async () => {
        throw new Error('no');
      },
      label,
      { writer: new MemoryWriter(), clock: fakeClock(), stopAfterConsecutiveFailures: 0 },
    );
    expect(report.failed).toBe(3);
  });

  it('reports progress per item', async () => {
    const seen: [number, number][] = [];
    await runPaced(NSE, ['a', 'b'], async () => harvest(), label, {
      writer: new MemoryWriter(),
      clock: fakeClock(),
      onProgress: (done, total) => seen.push([done, total]),
    });
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('tallies the skips, most frequent first', async () => {
    const report = await runPaced(
      NSE,
      ['a', 'b', 'c'],
      async (s) => harvest({ skipped: [{ at: s, reason: s === 'c' ? 'rare' : 'common' }] }),
      label,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );
    expect(report.tally).toEqual([
      { reason: 'common', count: 2 },
      { reason: 'rare', count: 1 },
    ]);
  });
});

describe('runBatched', () => {
  it('does not pace, and reports zero requests', async () => {
    // A bulk file was downloaded once. Counting requests as zero is accurate and
    // is also how the summary tells a bulk load from a per-item one.
    const report = await runBatched(
      'mca_master',
      [harvest({ companies: [company({ cin: 'U1' })] }), harvest({ companies: [company({ cin: 'U2' })] })],
      { writer: new MemoryWriter() },
    );
    expect(report.requests).toBe(0);
    expect(report.companiesWritten).toBe(2);
  });

  it('counts rows as requested, including the ones it skipped', async () => {
    const report = await runBatched(
      'mca_master',
      [harvest({ companies: [company()], skipped: [{ at: 'row 2', reason: 'Company status is STRIKE OFF' }] })],
      { writer: new MemoryWriter() },
    );
    expect(report.requested).toBe(2);
    expect(report.skipped).toHaveLength(1);
  });

  it('survives one company in a batch throwing, as a skip rather than a batch failure', async () => {
    // writeHarvest now isolates a single company's upsert throwing (see its own
    // doc comment) — this used to be indistinguishable from the whole batch
    // exploding, and for a bulk MCA batch of hundreds of companies that
    // distinction is the difference between losing one row and losing the rest
    // of the file behind it.
    const exploding = {
      async upsertCompany(): Promise<string> {
        throw new Error('write failed');
      },
      recordFinancials: async () => undefined,
      recordQuote: async () => undefined,
      resolve: async () => null,
      recordLookup: async () => undefined,
    };
    const report = await runBatched('mca_master', [harvest({ companies: [company()] })], {
      writer: exploding,
    });
    expect(report.failed).toBe(0);
    expect(report.companiesWritten).toBe(0);
    expect(report.skipped[0]).toEqual({ at: 'Example Ltd', reason: 'Threw: write failed' });
  });

  it('accepts an async iterable, which is how a streamed file arrives', async () => {
    async function* stream() {
      yield harvest({ companies: [company({ cin: 'U1' })] });
      yield harvest({ companies: [company({ cin: 'U2' })] });
    }
    const report = await runBatched('mca_master', stream(), { writer: new MemoryWriter() });
    expect(report.companiesWritten).toBe(2);
  });
});

describe('messageOf', () => {
  it('reads an Error, a string and anything else', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('boom')).toBe('boom');
    expect(messageOf({ code: 42 })).toBe('{"code":42}');
  });
});

describe('summarise', () => {
  it('never omits what was skipped', async () => {
    // A run reporting "2,317 companies" and nothing about the 46 rows it could
    // not read is hiding the only part of its output that needs attention.
    const report = await runPaced(
      NSE,
      ['a', 'b'],
      async (s) =>
        s === 'a'
          ? harvest({ companies: [company()] })
          : harvest({ skipped: [{ at: 'b', reason: 'No market capitalisation found' }] }),
      (s) => s,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );

    expect(summarise(report)).toBe('nse · 1 companies · 1 skipped');
  });

  it('marks a dry run as one', async () => {
    const report = await runBatched('mca_master', [harvest()], { writer: new MemoryWriter() });
    expect(summarise({ ...report, dryRun: true })).toContain('(dry run)');
  });

  it('mentions pacing only when it was more than a second', async () => {
    const short = await runPaced(NSE, ['a', 'b'], async () => harvest(), (s) => s, {
      writer: new MemoryWriter(),
      clock: fakeClock(),
    });
    expect(summarise(short)).not.toContain('paced');

    const long = await runPaced(
      NSE,
      Array.from({ length: 10 }, (_, i) => `S${i}`),
      async () => harvest(),
      (s) => s,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );
    expect(summarise(long)).toContain('3s paced');
  });
});

describe('skipLines', () => {
  it('renders the tally with counts, which is the part worth reading', async () => {
    const report = await runPaced(
      NSE,
      ['a', 'b'],
      async (s) => harvest({ skipped: [{ at: s, reason: 'No market capitalisation found' }] }),
      (s) => s,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );
    expect(skipLines(report)).toEqual(['        2  No market capitalisation found']);
  });

  it('truncates a long tail', async () => {
    const report = await runPaced(
      NSE,
      Array.from({ length: 30 }, (_, i) => `S${i}`),
      async (s) => harvest({ skipped: [{ at: s, reason: `reason ${s}` }] }),
      (s) => s,
      { writer: new MemoryWriter(), clock: fakeClock() },
    );
    expect(skipLines(report, 5)).toHaveLength(5);
  });
});
