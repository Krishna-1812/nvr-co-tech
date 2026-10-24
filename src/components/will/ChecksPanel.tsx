'use client';

import type { CSSProperties } from 'react';
import { CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { SEVERITY_LABEL, SEVERITY_TONE, Tag } from '@/components/wealth/shared';
import type { Finding } from '@/lib/will/checks';

/**
 * Everything the checks found, worst first, each with the fix one tap away.
 *
 * "Act on this" holds the final export; the rest never blocks. The wording is
 * the checks' own (lib/will/checks), with the statute section under each one
 * that rests on one, so a reader can see it is a rule and not an opinion.
 */
export function ChecksPanel({ findings, onFix }: { findings: Finding[]; onFix: (f: Finding) => void }) {
  if (findings.length === 0) {
    return (
      <div className="surface-lit a-ring flex items-center gap-3 rounded-2xl border p-5 text-sm">
        <CircleCheck className="size-5 shrink-0 text-[var(--status-approved)]" aria-hidden />
        Nothing to look at. That does not mean it has been read by a lawyer.
      </div>
    );
  }
  return (
    <ul className="space-y-2.5" aria-label="Checks">
      {findings.map((f) => (
        <li
          key={f.id}
          style={{ '--tone': SEVERITY_TONE[f.severity] } as CSSProperties}
          className={f.severity === 'note' ? 'surface-sunken rounded-2xl border p-4' : 'tinted rounded-2xl border p-4'}
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</Tag>
                <span className="text-sm font-semibold">{f.title}</span>
              </div>
              <p className="text-muted mt-1.5 text-[13px] leading-relaxed text-pretty">{f.detail}</p>
              {f.cite && <p className="text-subtle mt-1 text-[11.5px]">{f.cite}</p>}
            </div>
            <Button size="sm" onClick={() => onFix(f)}>
              Fix
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
