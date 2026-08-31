import { ldJson } from '@/lib/marketing/seo';

/**
 * A block of structured data.
 *
 * Rendered as an ordinary <script> in the page body rather than injected into
 * <head>. Both are valid — Google reads JSON-LD wherever it appears in the
 * document — and in the body it arrives with the server-rendered HTML on the
 * first response, which is the only thing that matters here.
 *
 * `Breadcrumbs` emits its own rather than using this, because there the trail
 * and the markup have to come from one array. See the note in that file.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // ldJson escapes the one character that could close this tag early. There
      // is no non-dangerous way to write a JSON-LD block in React.
      dangerouslySetInnerHTML={{ __html: ldJson(data) }}
    />
  );
}
