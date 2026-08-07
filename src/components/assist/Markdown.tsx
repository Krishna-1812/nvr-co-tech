import Link from 'next/link';
import { parseMarkdown, type Block, type Inline } from '@/lib/assist/markdown';

/**
 * The answer, as elements.
 *
 * Every node here comes from the parser's tree, so there is no point at which a
 * string written by the model is handed to the HTML parser. See the note at the
 * top of lib/assist/markdown for why that matters more here than in most places
 * markdown gets rendered.
 *
 * The type scale is the app's, not a chat window's. A figure inside an answer
 * should look like a figure everywhere else in this application, which is why
 * tables get the same treatment as a register and code gets the mono face rather
 * than a grey box.
 */

function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, i) => {
        switch (run.type) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-[var(--text-c)]">
                {run.text}
              </strong>
            );
          case 'italic':
            return (
              <em key={i} className="italic">
                {run.text}
              </em>
            );
          case 'code':
            return (
              <code
                key={i}
                className="surface-sunken numeric rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em]"
              >
                {run.text}
              </code>
            );
          case 'link':
            // Only ever a path inside this app; the parser drops everything else
            // to plain text. Which is what makes a plain <Link> safe here.
            return (
              <Link
                key={i}
                href={run.href}
                className="text-brand-600 dark:text-brand-300 font-medium underline decoration-current/30 underline-offset-2 hover:decoration-current"
              >
                {run.text}
              </Link>
            );
          default:
            return <span key={i}>{run.text}</span>;
        }
      })}
    </>
  );
}

function Rendered({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading':
      return block.level === 2 ? (
        <h2 className="mt-5 mb-2 text-[15px] font-semibold tracking-tight first:mt-0">
          <Runs runs={block.text} />
        </h2>
      ) : (
        <h3 className="text-muted mt-4 mb-1.5 text-[13px] font-semibold tracking-tight first:mt-0">
          <Runs runs={block.text} />
        </h3>
      );

    case 'para':
      return (
        <p className="my-2.5 leading-relaxed first:mt-0 last:mb-0">
          <Runs runs={block.text} />
        </p>
      );

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="my-2.5 space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 leading-relaxed">
              {/* The marker is drawn rather than left to the list style, so an
                  ordered list keeps its numbers aligned with tabular figures and
                  a bulleted one gets the brand dot instead of a browser bullet. */}
              <span
                aria-hidden
                className={
                  block.ordered
                    ? 'numeric text-subtle w-4 shrink-0 pt-px text-right text-[11px] font-semibold'
                    : 'mt-[0.6em] size-1.5 shrink-0 rounded-full bg-[var(--color-brand-500)]/60'
                }
              >
                {block.ordered ? i + 1 : null}
              </span>
              <span className="min-w-0 flex-1">
                <Runs runs={item} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }

    case 'quote':
      return (
        <blockquote className="text-muted my-3 border-l-2 border-[var(--color-brand-500)]/40 py-0.5 pl-3.5 text-[13.5px] leading-relaxed italic">
          <Runs runs={block.text} />
        </blockquote>
      );

    case 'code':
      return (
        <pre className="surface-sunken scroll-x-hint my-3 overflow-x-auto rounded-xl border p-3.5 text-[12.5px] leading-relaxed">
          <code className="font-[family-name:var(--font-mono)]">{block.text}</code>
        </pre>
      );

    case 'table':
      return (
        <div className="scroll-x-hint surface-sunken my-3 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-[13px]">
            <thead className="text-subtle border-b">
              <tr>
                {block.head.map((cell, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-2 text-[10.5px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase"
                  >
                    <Runs runs={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="numeric px-3 py-2 align-top">
                      <Runs runs={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'rule':
      return <hr className="my-4 border-0 border-t" />;
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div className="text-[14px] text-[var(--text-c)]">
      {blocks.map((block, i) => (
        <Rendered key={i} block={block} />
      ))}
    </div>
  );
}
