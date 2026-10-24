'use client';

import { useMemo } from 'react';
import { buildWill } from '@/lib/will/document';
import { readiness, type Finding } from '@/lib/will/checks';
import { LAW } from '@/lib/will/law';
import type { WillRecord } from '@/lib/will/model';
import { ExportBar } from './ExportBar';
import { Notice } from './shared';

/**
 * The will as it reads, built live from the record.
 *
 * This is the same `WillDocument` the PDF and the Word file will be drawn
 * from, so what is read here is what will be printed. Blank lines to write on
 * show as lines. Nothing here is final: the band says so until nothing is left
 * to fix, and even then says the draft has not been through a lawyer.
 */
export function Preview({ record, findings, today }: { record: WillRecord; findings: Finding[]; today: string }) {
  const doc = useMemo(() => buildWill(record, today), [record, today]);
  const ready = readiness(findings);
  const letter = (i: number) => `(${String.fromCharCode(97 + i)})`;

  return (
    <div className="space-y-4">
      <Notice tone={ready.ready ? 'var(--status-draft)' : 'var(--status-warn)'}>
        <strong>Draft. Not for signing yet.</strong>{' '}
        {ready.ready
          ? 'Nothing is holding this draft back, but it has not been read by a lawyer.'
          : `${ready.act} thing${ready.act === 1 ? '' : 's'} to fix first (see Checks).`}{' '}
        {LAW.advocateSignOff ? '' : 'The rules behind this tool are awaiting an advocate’s review.'}
      </Notice>

      <ExportBar record={record} today={today} />

      <article
        aria-label="Draft of your will"
        className="a-ring mx-auto max-w-3xl rounded-2xl border bg-[var(--surface-raised)] px-6 py-8 font-serif text-[15.5px] leading-[1.75] shadow-[var(--elev-2)] sm:px-14 sm:py-12"
      >
        <h2 className="text-center text-2xl font-semibold tracking-[0.18em]">{doc.title}</h2>

        <div className="mt-8 space-y-3">
          {doc.opening.map((p, i) => (
            <p key={i} className="text-pretty">
              {p}
            </p>
          ))}
        </div>

        {doc.sections.map((s) => (
          <section key={s.id} className="mt-7">
            <h3 className="font-semibold">
              {s.number}. {s.heading}
            </h3>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-1.5 text-pretty">
                {p}
              </p>
            ))}
            {s.items.length > 0 && (
              <ol className="mt-2 space-y-2">
                {s.items.map((it, i) => (
                  <li key={i} className="grid grid-cols-[2rem_1fr] text-pretty">
                    <span>{letter(i)}</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

        {doc.schedule.length > 0 && (
          <section className="mt-9">
            <h3 className="text-center font-semibold tracking-[0.18em]">SCHEDULE</h3>
            <div className="mt-4 overflow-x-auto" role="region" aria-label="Schedule of assets" tabIndex={0}>
              <table className="w-full min-w-[32rem] border-collapse text-[14px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="w-10 py-1.5 pr-2 font-semibold">No.</th>
                    <th className="py-1.5 pr-3 font-semibold">What</th>
                    <th className="py-1.5 pr-3 font-semibold">How to find it</th>
                    <th className="py-1.5 font-semibold">Given</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.schedule.map((r) => (
                    <tr key={r.no} className="border-b align-top">
                      <td className="py-2 pr-2 tabular-nums">{r.no}</td>
                      <td className="py-2 pr-3">
                        {r.title}
                        <span className="text-muted block text-[12.5px]">{r.kind}</span>
                      </td>
                      <td className="py-2 pr-3">{r.description}</td>
                      <td className="py-2">{r.ownership}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-10">
          <p className="text-pretty">{doc.signing.text}</p>
          <div className="mt-8 w-64 border-t pt-1.5 text-sm">{doc.signing.testator}</div>
        </section>

        <section className="mt-10">
          <p className="text-pretty">{doc.attestation.text}</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            {doc.attestation.witnesses.map((w, i) => (
              <div key={i} className="text-sm">
                <div className="mt-8 border-t pt-1.5">Witness {i + 1}</div>
                <div>{w.name || <span className="text-subtle">Name:</span>}</div>
                <div className="text-muted">{w.address || 'Address:'}</div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-subtle mt-10 border-t pt-3 text-center font-sans text-[11px]">
          Drafted with Will Maker from rules checked on {doc.rulesCheckedOn}. A drafting aid, not legal advice.
        </p>
      </article>
    </div>
  );
}
