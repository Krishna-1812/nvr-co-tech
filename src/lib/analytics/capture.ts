'use client';

/**
 * The browser side of "what people entered" (migration 0036), beside the page
 * tracker in components/Tracker.
 *
 * Two things go up, both to /api/track/input:
 *   - the work in an open tool (True Property Cost, Wealth Tracker), as the
 *     same text the tool keeps in localStorage, a moment after typing pauses.
 *     A Wealth Tracker record locked with a passcode is ciphertext by then and
 *     goes up as ciphertext, marked `sealed`;
 *   - form fields filled and buttons and links pressed, anywhere on the site,
 *     collected for a few seconds and sent together.
 *
 * What is never read: passwords, one-time codes, card numbers, file pickers,
 * hidden inputs, anything inside `[data-private]`, and the two open tools' own
 * fields (their whole record already goes up, and a locked record must not go
 * up field by field in the clear). Nothing at all is sent from the Admin
 * screen, or from a browser asking not to be tracked, the same rule as the
 * page tracker.
 */

const ENDPOINT = '/api/track/input';
const UUID = /(?:^|;\s*)fi_vid=([0-9a-f-]{36})/i;

export type CaptureTool = 'wealth-tracker' | 'true-property-cost';

/** The open tools, whose fields are captured as a whole record instead. */
const TOOL_PATHS = ['/wealth-tracker', '/true-property-cost'];

function vid(): string | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.match(UUID)?.[1] ?? null;
}

function sid(): string | null {
  try {
    return sessionStorage.getItem('fi_sid');
  } catch {
    return null;
  }
}

export function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

const under = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

function post(body: Record<string, unknown>, leaving = false) {
  const json = JSON.stringify(body);
  // A beacon carries at most 64 KB; a large record goes as an ordinary request.
  if (leaving && json.length < 60_000 && navigator.sendBeacon?.(ENDPOINT, new Blob([json], { type: 'application/json' }))) return;
  fetch(ENDPOINT, { method: 'POST', body: json, keepalive: json.length < 60_000, headers: { 'content-type': 'application/json' } }).catch(() => {});
}

// ── A tool's work ───────────────────────────────────────────────────────────

const pending = new Map<CaptureTool, { body: string; timer: ReturnType<typeof setTimeout> }>();
const lastSent = new Map<CaptureTool, string>();

function sealedText(body: string): boolean {
  try {
    const o = JSON.parse(body) as Record<string, unknown> | null;
    return !!o && typeof o === 'object' && typeof o.sealed === 'string';
  } catch {
    return false;
  }
}

function sendTool(tool: CaptureTool, body: string, leaving = false) {
  const id = vid();
  if (!id || lastSent.get(tool) === body) return;
  lastSent.set(tool, body);
  post({ type: 'tool', vid: id, sid: sid(), tool, body, sealed: sealedText(body) }, leaving);
}

/**
 * Called by a tool's store after each save, with the text it saved. Sent two
 * seconds after the last call, so typing a number is one request, not ten.
 */
export function captureTool(tool: CaptureTool, body: string) {
  if (typeof window === 'undefined' || optedOut()) return;
  const was = pending.get(tool);
  if (was) clearTimeout(was.timer);
  pending.set(tool, {
    body,
    timer: setTimeout(() => {
      pending.delete(tool);
      sendTool(tool, body);
    }, 2000),
  });
}

/** Sends anything still waiting, for when the page is being left. */
function flushTools() {
  for (const [tool, p] of pending) {
    clearTimeout(p.timer);
    sendTool(tool, p.body, true);
  }
  pending.clear();
}

// ── Fields and clicks ───────────────────────────────────────────────────────

type Captured = { kind: 'field' | 'click'; path: string; label: string | null; value: string | null; at: string };

let queue: Captured[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flushEvents(leaving = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  const id = vid();
  if (!id || queue.length === 0) return;
  const events = queue.slice(0, 100);
  queue = [];
  post({ type: 'events', vid: id, sid: sid(), events }, leaving);
}

function push(e: Omit<Captured, 'at' | 'path'>) {
  const path = location.pathname;
  // Two changes to the same field in a row keep only the last.
  const last = queue.at(-1);
  if (e.kind === 'field' && last?.kind === 'field' && last.path === path && last.label === e.label) queue.pop();
  queue.push({ ...e, path, at: new Date().toISOString() });
  if (queue.length >= 50) flushEvents();
  else if (!timer) timer = setTimeout(() => flushEvents(), 5000);
}

const words = (s: string | null | undefined, n = 200) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, n) : null;
};

const SECRET = /password|one-time-code|cc-number|cc-csc|cc-exp/i;

/** Whether a field must never be read. */
export function isPrivateField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (el instanceof HTMLInputElement && ['password', 'hidden', 'file'].includes(el.type)) return true;
  if (SECRET.test(el.getAttribute('autocomplete') ?? '')) return true;
  return !!el.closest('[data-private]');
}

/** The words a person would use for a field: its label, else its hint or name. */
function fieldLabel(el: HTMLElement): string | null {
  const aria = el.getAttribute('aria-label');
  if (aria) return words(aria);
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const text = by
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (words(text)) return words(text);
  }
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label && words(label.textContent)) return words(label.textContent);
  }
  const wrap = el.closest('label');
  if (wrap && words(wrap.textContent)) return words(wrap.textContent);
  return words(el.getAttribute('placeholder')) ?? words(el.getAttribute('name')) ?? words(el.id) ?? el.tagName.toLowerCase();
}

function fieldValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
  if (el instanceof HTMLSelectElement) return words(el.selectedOptions[0]?.textContent ?? el.value, 4000);
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked ? 'Ticked' : 'Unticked';
  if (el instanceof HTMLInputElement && el.type === 'radio') return el.checked ? (fieldLabel(el) ?? el.value) : null;
  return el.value.trim() ? el.value.slice(0, 4000) : null;
}

function onChange(e: Event) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
  if (under(location.pathname, TOOL_PATHS) || isPrivateField(el)) return;
  const value = fieldValue(el);
  if (value === null) return;
  // A radio button's label is its choice; the question is the group's legend.
  const label = el instanceof HTMLInputElement && el.type === 'radio' ? (words(el.closest('fieldset')?.querySelector('legend')?.textContent) ?? el.name) : fieldLabel(el);
  push({ kind: 'field', label, value });
}

function onClick(e: MouseEvent) {
  const target = e.target instanceof Element ? e.target.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary') : null;
  if (!target || target.closest('[data-private]')) return;
  const label = words(target.getAttribute('aria-label')) ?? words((target as HTMLElement).innerText) ?? words(target.getAttribute('title'));
  let value: string | null = null;
  if (target instanceof HTMLAnchorElement && target.href) {
    try {
      const url = new URL(target.href);
      // The path alone for our own links (queries carry tokens), the whole address for anybody else's.
      value = url.origin === location.origin ? url.pathname : `${url.origin}${url.pathname}`;
    } catch {
      value = null;
    }
  }
  if (!label && !value) return;
  push({ kind: 'click', label, value });
}

let started = false;

/**
 * Starts listening for fields and clicks, once per page load. The tracker calls
 * it; it stands down by itself on the Admin screen.
 */
export function startCapture() {
  if (started || typeof window === 'undefined' || optedOut()) return;
  started = true;
  const off = () => location.pathname.startsWith('/analytics');
  document.addEventListener('change', (e) => !off() && onChange(e), true);
  document.addEventListener('click', (e) => !off() && onClick(e), true);
  const leave = () => {
    flushEvents(true);
    flushTools();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave();
  });
  window.addEventListener('pagehide', leave);
}
