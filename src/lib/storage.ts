import { storage } from 'wxt/utils/storage';
import { DrawerStateSchema, type DrawerItem, type DrawerState } from './schema';
import { logger } from './logger';

const KEY = 'local:drawer' as const;
const EMPTY: DrawerState = { items: [] };

async function read(): Promise<DrawerState> {
  const raw = await storage.getItem<unknown>(KEY);
  if (raw == null) return EMPTY;
  const parsed = DrawerStateSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('drawer state failed validation, resetting', parsed.error);
    return EMPTY;
  }
  return parsed.data;
}

async function write(state: DrawerState): Promise<void> {
  await storage.setItem(KEY, DrawerStateSchema.parse(state));
}

export const drawerStorage = {
  async getAll(): Promise<DrawerItem[]> {
    return (await read()).items;
  },
  async add(item: DrawerItem): Promise<void> {
    const state = await read();
    await write({ items: [item, ...state.items] });
  },
  async remove(id: string): Promise<void> {
    const state = await read();
    await write({ items: state.items.filter((i) => i.id !== id) });
  },
  // Items captured on a fresh chat have no conversation id yet. Once the URL
  // grows one, they belong to that conversation.
  async adopt(site: DrawerItem['site'], conversationId: string): Promise<void> {
    const state = await read();
    const pending = state.items.some(
      (i) => i.site === site && i.conversationId === null,
    );
    // Skip the write so we don't wake every watcher for nothing.
    if (!pending) return;
    await write({
      items: state.items.map((i) =>
        i.site === site && i.conversationId === null ? { ...i, conversationId } : i,
      ),
    });
  },
  watch(cb: (items: DrawerItem[]) => void): () => void {
    return storage.watch<unknown>(KEY, (raw) => {
      const parsed = DrawerStateSchema.safeParse(raw ?? EMPTY);
      cb(parsed.success ? parsed.data.items : []);
    });
  },
};
