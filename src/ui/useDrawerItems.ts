import { useEffect, useMemo, useState } from 'react';
import { drawerStorage } from '@/src/lib/storage';
import type { DrawerItem } from '@/src/lib/schema';

export function useDrawerItems(
  site: DrawerItem['site'],
  conversationId: string | null,
) {
  const [stored, setStored] = useState<DrawerItem[]>([]);

  useEffect(() => {
    let active = true;
    drawerStorage.getAll().then((loaded) => {
      if (active) setStored(loaded);
    });
    const unwatch = drawerStorage.watch(setStored);
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  // Storage keeps every item; the drawer only shows the ones from the chat the
  // user is looking at. A null conversationId is a chat with no id yet, and
  // matches the items parked there.
  const items = useMemo(
    () =>
      stored.filter((i) => i.site === site && i.conversationId === conversationId),
    [stored, site, conversationId],
  );

  const remove = (id: string) => {
    void drawerStorage.remove(id);
  };

  return { items, remove };
}
