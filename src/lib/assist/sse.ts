/**
 * Reading server-sent events out of a byte stream.
 *
 * Written rather than pulled in, for one reason: a stream arrives in whatever
 * chunks the network decides on, and those boundaries fall in the middle of JSON
 * objects. The bug this file exists to prevent is the one where everything works
 * on a fast local connection, because each chunk happens to be a whole event,
 * and then produces truncated answers over a slow one. That is a bug you cannot
 * find by using the feature, only by holding back the buffer on purpose, which
 * is exactly what the tests here do.
 *
 * The format, in the small part of it that matters:
 *   - one event is a run of lines ending at a blank line
 *   - a line starting with ':' is a comment, usually a keep-alive
 *   - 'data:' lines carry the payload, and several of them concatenate with \n
 *   - 'event:' lines name the event, which is ignored here because the payloads
 *     this API sends already carry their own `type`
 *   - 'data: [DONE]' is the end sentinel
 */

export type SseParser = {
  /** Feed a chunk. Returns whatever complete payloads it completed. */
  push(chunk: string): string[];
  /** Whatever is left when the stream closes without a trailing blank line. */
  flush(): string[];
};

export function createSseParser(): SseParser {
  /** Bytes seen but not yet ending in a newline. */
  let carry = '';
  /** `data:` lines of the event currently being assembled. */
  let data: string[] = [];

  const finish = (out: string[]) => {
    if (data.length === 0) return;
    const payload = data.join('\n');
    data = [];
    // The sentinel is not a payload, and JSON.parse would throw on it.
    if (payload !== '[DONE]') out.push(payload);
  };

  const line = (raw: string, out: string[]) => {
    // \r\n line endings are legal and some proxies rewrite to them.
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (text === '') {
      finish(out);
      return;
    }
    if (text.startsWith(':')) return;

    if (text.startsWith('data:')) {
      // One optional space after the colon is part of the format and is not
      // part of the value. Any further spaces are.
      const value = text.slice(5);
      data.push(value.startsWith(' ') ? value.slice(1) : value);
    }
    // 'event:', 'id:' and 'retry:' are deliberately dropped.
  };

  return {
    push(chunk) {
      const out: string[] = [];
      carry += chunk;

      let newline = carry.indexOf('\n');
      while (newline !== -1) {
        line(carry.slice(0, newline), out);
        carry = carry.slice(newline + 1);
        newline = carry.indexOf('\n');
      }

      return out;
    },

    flush() {
      const out: string[] = [];
      // A stream that ends without its final blank line still delivered its last
      // event, and dropping it would silently truncate the answer.
      if (carry) {
        line(carry, out);
        carry = '';
      }
      finish(out);
      return out;
    },
  };
}

/**
 * Parse each payload, dropping any that is not JSON.
 *
 * A malformed frame is not worth failing an answer over: it is one event out of
 * hundreds, the stream carries on, and throwing here would lose everything
 * written so far.
 */
export function parsePayloads(payloads: string[]): unknown[] {
  const out: unknown[] = [];
  for (const payload of payloads) {
    try {
      out.push(JSON.parse(payload));
    } catch {
      // Ignored on purpose. See above.
    }
  }
  return out;
}
