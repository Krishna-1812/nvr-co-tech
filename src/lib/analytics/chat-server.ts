import { createClient } from '@/lib/supabase/server';
import { readVisitorCookie } from './cookie';
import { chatPayload, mayRecord } from './chat';

/**
 * Files one question and its answer (lib/analytics/chat, migration 0039).
 *
 * The Supabase client carries the reader's own session, so track_chat() takes
 * the account from auth.uid() and never from here; the visitor is the
 * browser's own cookie. It never throws: recording is never why an answer
 * fails, and the reader has already been sent everything by the time it runs.
 */
export async function recordChat(request: Request, row: Omit<Parameters<typeof chatPayload>[0], 'vid'>): Promise<void> {
  try {
    if (!mayRecord(request.headers, row.meta.path)) return;
    const vid = readVisitorCookie(request.headers.get('cookie'));
    const supabase = await createClient();
    await supabase.rpc('track_chat', { p: chatPayload({ ...row, vid }) });
  } catch {
    // Not recorded; nothing else to do about it.
  }
}
