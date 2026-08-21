'use client';

import { useMemo, useState } from 'react';
import { Download, Inbox, Search } from 'lucide-react';
import { Card, CardTitle, EmptyState, Input } from '@/components/ui/primitives';
import { NUM } from '@/components/analytics/Figures';
import { cn } from '@/lib/utils';

/**
 * A flat, searchable, exportable log. Two of them, one per kind of request.
 *
 * No sorting and no drill-down, on purpose: this is a report, not a dashboard.
 * Both tables are newest-first as the server returned them, because the only
 * ordering question anybody has about a queue of requests is which came in last.
 *
 * The export takes whatever is currently visible rather than everything. That is
 * the useful behaviour and also the honest one — somebody who has searched for
 * one firm and pressed the button meant to export that firm, and handing them
 * four hundred rows instead would be a surprise they discover in a spreadsheet.
 */

export type Column<Row> = {
  header: string;
  /** Rendered in the table. */
  cell: (row: Row) => React.ReactNode;
  /** Written into the CSV. Kept separate because a cell can carry markup. */
  text: (row: Row) => string;
  className?: string;
};

export function RequestTable<Row>({
  title,
  description,
  rows,
  columns,
  /** Every searchable field of a row, lowercased once by the server. */
  haystacks,
  filename,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  description: string;
  rows: Row[];
  columns: Column<Row>[];
  haystacks: string[];
  filename: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows.map((row, i) => ({ row, i }));
    return rows
      .map((row, i) => ({ row, i }))
      .filter(({ i }) => haystacks[i]?.includes(needle));
  }, [rows, haystacks, query]);

  const exportCsv = () => {
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const csv = [
      columns.map((c) => escape(c.header)).join(','),
      ...shown.map(({ row }) => columns.map((c) => escape(c.text(row))).join(',')),
    ].join('\n');

    // Built and downloaded entirely in the browser: the rows are already here,
    // and a round trip to have the server rebuild what is on screen could only
    // disagree with it.
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden">
      <CardTitle
        title={title}
        description={description}
        action={
          rows.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
            >
              <Download className="size-3.5" aria-hidden />
              Export what is shown
            </button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title={emptyTitle} description={emptyBody} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <span className="relative min-w-[13rem] flex-1">
              <Search
                className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search these requests"
                aria-label={`Search ${title}`}
                className="!rounded-full !pl-8"
              />
            </span>
            <span className={cn(NUM, 'text-subtle text-[11px]')}>
              {shown.length} of {rows.length} shown
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="text-subtle px-5 py-10 text-center text-sm">
              Nothing matches that. Clearing the box brings them all back.
            </p>
          ) : (
            <div className="scroll-x-hint overflow-x-auto">
              {/*
                On a narrow screen each row becomes a block of label-and-value
                pairs rather than a sideways scroll, which is why every cell
                carries its own header in a data attribute.
              */}
              <table className="w-full text-left text-[12.5px] max-sm:block">
                <thead className="max-sm:hidden">
                  <tr className="[&>th]:a-label [&>th]:border-b [&>th]:px-5 [&>th]:pb-2">
                    {columns.map((column) => (
                      <th key={column.header}>{column.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y max-sm:block">
                  {shown.map(({ row, i }) => (
                    <tr key={i} className="max-sm:block max-sm:px-5 max-sm:py-3">
                      {columns.map((column) => (
                        <td
                          key={column.header}
                          data-label={column.header}
                          className={cn(
                            'px-5 py-2.5 align-top',
                            'max-sm:flex max-sm:gap-3 max-sm:px-0 max-sm:py-1',
                            "max-sm:before:content-[attr(data-label)] max-sm:before:text-subtle max-sm:before:w-28 max-sm:before:shrink-0 max-sm:before:text-[10px] max-sm:before:uppercase",
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
