import { neverCaptured } from './private-paths';
import { isBot } from './ua';

/**
 * One message from lib/analytics/capture, checked and turned into what
 * `track_input()` (migration 0036) stores: either a tool's whole record, or a
 * batch of fields filled and buttons pressed.
 *
 * Nothing is trusted beyond its shape. The visitor ID must look like one, the
 * tool must be one of the two open tools, a record is capped at the size the
 * table allows, a batch at a hundred events, and every text is cut to length.
 * The account is never taken from here; the database reads it from the
 * session.
 *
 * Pure, so the rules are tested without a request.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOOLS = ['wealth-tracker', 'true-property-cost'];
export const MAX_RECORD = 2_000_000;

function text(v: unknown, n: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, n);
  return t || null;
}

export function buildInput(body: unknown, userAgent: string | null): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || isBot(userAgent)) return null;
  const b = body as Record<string, unknown>;
  const vid = typeof b.vid === 'string' && UUID.test(b.vid) ? b.vid : null;
  if (!vid) return null;
  const sid = text(b.sid, 64);

  if (b.type === 'tool') {
    if (typeof b.tool !== 'string' || !TOOLS.includes(b.tool)) return null;
    if (typeof b.body !== 'string' || !b.body || b.body.length > MAX_RECORD) return null;
    return { type: 'tool', vid, sid, tool: b.tool, body: b.body, sealed: b.sealed === true };
  }

  if (b.type === 'events' && Array.isArray(b.events)) {
    const events = b.events
      .slice(0, 100)
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .filter((e) => e.kind === 'field' || e.kind === 'click')
      .map((e) => ({
        kind: e.kind,
        path: text(e.path, 500) ?? '/',
        label: text(e.label, 200),
        value: text(e.value, 4000),
        at: typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) ? e.at : null,
      }))
      // Nothing from a will, whatever the client claims (lib/analytics/private-paths).
      .filter((e) => !neverCaptured(e.path))
      .filter((e) => e.label || e.value);
    return events.length ? { type: 'events', vid, sid, events } : null;
  }
  return null;
}
