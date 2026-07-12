import { useEffect, useState } from 'react';
import type { DrawerItem } from '@/src/lib/schema';

export const FRESH_MS = 8000;

/**
 * The id of the newest item while it is still "just added", else null.
 * Derived from createdAt so nothing new has to be persisted.
 */
export function useFreshItemId(newest?: DrawerItem): string | null {
  const [now, setNow] = useState(() => Date.now());

  const id = newest?.id;
  const createdAt = newest?.createdAt;

  useEffect(() => {
    if (createdAt == null) return;
    const remaining = createdAt + FRESH_MS - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [id, createdAt]);

  if (!newest) return null;
  return newest.createdAt + FRESH_MS > now ? newest.id : null;
}
