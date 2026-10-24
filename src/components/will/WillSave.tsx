'use client';

import { useCallback, useEffect } from 'react';
import { startSync } from '@/lib/cloud/sync';
import { reloadWill, willIsEmpty, willIsSealed, willKey } from '@/lib/will/store';

/**
 * Keeps an encrypted copy of the will in the signed-in person's account.
 *
 * Renders nothing; it starts the account sync (lib/cloud) for Will Maker, once,
 * for a signed-in person. The one thing that makes this different from Wealth
 * Tracker and True Property Cost is `accept`: only text that is already a
 * locked draft may leave the browser. A draft with no passcode stays here, and
 * the "Where it is kept" tab says why. As for the other tools, a visitor's
 * draft becomes the signed-in person's on this device when they sign in; it is
 * not sent anywhere unless and until it is locked.
 */
export function WillSave({ userId, signedIn }: { userId: string; signedIn: boolean }) {
  const reload = useCallback(() => reloadWill(userId), [userId]);
  useEffect(() => {
    if (!signedIn) return;
    startSync({ tool: 'will-maker', key: willKey(userId), guestKey: willKey('guest'), reload, isEmpty: willIsEmpty, accept: willIsSealed });
  }, [signedIn, userId, reload]);
  return null;
}
