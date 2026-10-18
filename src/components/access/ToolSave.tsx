'use client';

import { useCallback } from 'react';
import { reloadWealth, wealthIsEmpty, wealthKey } from '@/lib/wealth/store';
import { GUEST_LANDED_KEY, bindLandedUser, landedIsEmpty, landedKey, reloadLanded } from '@/lib/landed/store';
import { SaveStatus } from './SaveStatus';

/**
 * The save line for each open tool, with that tool's own storage keys. Client
 * components because the reload each one hands lib/cloud is a function, and a
 * server page cannot pass one.
 */

export function WealthSave({ userId, signedIn }: { userId: string; signedIn: boolean }) {
  const reload = useCallback(() => reloadWealth(userId), [userId]);
  return (
    <SaveStatus
      tool="wealth-tracker"
      signedIn={signedIn}
      storageKey={wealthKey(userId)}
      guestKey={wealthKey('guest')}
      reload={reload}
      isEmpty={wealthIsEmpty}
    />
  );
}

export function LandedSave({ userId }: { userId: string | null }) {
  bindLandedUser(userId);
  return (
    <SaveStatus
      tool="true-property-cost"
      signedIn={!!userId}
      storageKey={landedKey(userId)}
      guestKey={GUEST_LANDED_KEY}
      reload={reloadLanded}
      isEmpty={landedIsEmpty}
    />
  );
}
