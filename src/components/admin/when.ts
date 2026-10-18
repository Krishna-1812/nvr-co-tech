/** "just now", "12m ago", "3h ago", "2d ago", or a date once it is over a fortnight. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 14 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return stamp(iso, false);
}

/** A moment in India: "18 Oct 2026, 4:05 pm", or the date alone. */
export function stamp(iso: string, time = true): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}
