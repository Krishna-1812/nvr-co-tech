'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { PREVIEW } from '@/lib/preview';
import { createPreviewClient } from '@/lib/preview/client';

/** Supabase client for Client Components (auth forms, realtime, uploads). */
export function createClient() {
  // Preview mode: the sign-out button and the uploader would otherwise reach for
  // a Supabase URL that does not exist and reject with a network error.
  if (PREVIEW) {
    return createPreviewClient() as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
