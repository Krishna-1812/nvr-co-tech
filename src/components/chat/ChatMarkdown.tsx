import Link from 'next/link';
import { parseMarkdown, type Block, type Inline } from '@/lib/assist/markdown';

/**
 * An answer in the chat, as elements.
 *
 * The same parser as the full-page assistant (lib/assist/markdown), so nothing
 * the model writes ever reaches the HTML parser, and links are only ever paths
 * on this site. The styling is the chat's own: smaller type, links as warm
 * underlines, tables in a scroller so a wide one cannot push the panel sideways.
 */

function Runs({ runs, onNavigate }: { runs: Inline[]; onNavigate?: () => void }) {
  return (
    <>
      {runs.map((run, i) => {
        switch (run.type) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-[var(--c-ink)]">
                {run.text}
              </strong>
            );
          case 'italic':
            return <em key={i}>{run.text}</em>;
          case 'code':
            return (
              <code key={i} className="rounded-md bg-[var(--c-sand)] px-1.5 py-0.5 text-[0.88em]">
                {run.text}
              </code>
            );
          case 'link':
            return (
              <Link key={i} href={run.href} onClick={onNavigate} className="chat-link">
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

function Rendered({ block, onNavigate }: { block: Block; onNavigate?: () => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <p className="mt-3 mb-1 font-semibold text-[var(--c-ink)] first:mt-0">
          <Runs runs={block.text} onNavigate={onNavigate} />
        </p>
      );
    case 'para':
      return (
        <p className="my-2 first:mt-0 last:mb-0">
          <Runs runs={block.text} onNavigate={onNavigate} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="my-2 space-y-1.5 first:mt-0 last:mb-0">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                aria-hidden
                className={
                  block.ordered
                    ? 'w-4 shrink-0 pt-px text-right text-[11.5px] font-semibold text-[var(--c-accent)] tabular-nums'
                    : 'mt-[0.62em] size-1.5 shrink-0 rounded-full bg-[var(--c-sun)] ring-2 ring-[var(--c-sun)]/25'
                }
              >
                {block.ordered ? i + 1 : null}
              </span>
              <span className="min-w-0 flex-1">
                <Runs runs={item} onNavigate={onNavigate} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className="my-2 border-l-2 border-[var(--c-sun)] pl-3 text-[var(--c-dim)] italic">
          <Runs runs={block.text} onNavigate={onNavigate} />
        </blockquote>
      );
    case 'code':
      return (
        <pre className="my-2 overflow-x-auto rounded-xl bg-[var(--c-sand)] p-3 text-[12.5px]">
          <code>{block.text}</code>
        </pre>
      );
    case 'table':
      return (
        <div className="chat-scroll-x my-2.5 overflow-x-auto rounded-xl border border-[var(--c-line)] bg-[var(--c-bg)]">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-[var(--c-line)] text-[var(--c-dim)]">
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-[10.5px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase">
                    <Runs runs={cell} onNavigate={onNavigate} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-[var(--c-line)] last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top tabular-nums">
                      <Runs runs={cell} onNavigate={onNavigate} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr className="my-3 border-0 border-t border-[var(--c-line)]" />;
  }
}

export function ChatMarkdown({ source, onNavigate }: { source: string; onNavigate?: () => void }) {
  return (
    <>
      {parseMarkdown(source).map((block, i) => (
        <Rendered key={i} block={block} onNavigate={onNavigate} />
      ))}
    </>
  );
}
