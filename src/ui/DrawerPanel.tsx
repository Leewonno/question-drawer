import { useEffect, useMemo, useState } from 'react';
import { useDrawerItems } from './useDrawerItems';
import { useConversationId } from './useConversationId';
import { useFreshItemId } from './useFreshItemId';
import { DrawerItemCard } from './DrawerItemCard';
import { useHostTheme } from '@/src/lib/theme';
import { applyDock, cleanupDock, DRAWER_WIDTH_PX } from '@/src/lib/dock';
import type { SiteId } from '@/src/lib/site-adapter';
import type { DrawerItem } from '@/src/lib/schema';

interface Props {
  site: SiteId;
  onItemClick: (item: DrawerItem) => void;
}

export function DrawerPanel({ site, onItemClick }: Props) {
  const conversationId = useConversationId();
  const { items, remove } = useDrawerItems(site, conversationId);
  const [open, setOpen] = useState(true);
  const theme = useHostTheme();

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );
  const freshId = useFreshItemId(sorted[0]);

  useEffect(() => {
    applyDock(open);
  }, [open]);

  // Undock on unmount too. The content script's onRemove also calls this, but a
  // render error or an SPA teardown that skips onRemove would otherwise leave the
  // host page squeezed 320px with no drawer to un-squeeze it.
  useEffect(() => cleanupDock, []);

  const subtitle =
    sorted.length > 0
      ? `떠오른 질문 ${sorted.length}개 · 클릭하면 바로 질문`
      : '클릭 한 번으로 질문을 담아두세요';

  return (
    <div className={theme === 'dark' ? 'qd-dark' : undefined}>
      <button
        aria-label={open ? '서랍 닫기' : '서랍 열기'}
        onClick={() => setOpen((v) => !v)}
        style={{ right: open ? DRAWER_WIDTH_PX : 0 }}
        className="pointer-events-auto fixed top-1/3 z-[2147483647] rounded-l-lg border border-r-0 border-qd-line bg-qd-panel px-2 py-3 text-xs text-qd-muted shadow-sm dark:border-qd-line-dark dark:bg-qd-panel-dark dark:text-qd-muted-dark"
      >
        {open ? '›' : '‹'}
      </button>

      {open && (
        <aside
          style={{ width: DRAWER_WIDTH_PX }}
          className="pointer-events-auto fixed right-0 top-0 z-[2147483647] flex h-screen flex-col border-l border-qd-line bg-qd-panel font-sans dark:border-qd-line-dark dark:bg-qd-panel-dark"
        >
          <header className="px-4 pb-3 pt-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-qd-ink dark:text-qd-ink-dark">
              <span aria-hidden>🗄️</span>
              질문서랍
            </h2>
            <p className="mt-1 text-xs text-qd-muted dark:text-qd-muted-dark">{subtitle}</p>
          </header>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {sorted.length === 0 ? (
              <p className="rounded-xl border border-dashed border-qd-line px-3 py-6 text-center text-xs leading-relaxed text-balance text-qd-muted dark:border-qd-line-dark dark:text-qd-muted-dark">
                답변에서 궁금한 부분을 드래그해 담아보세요
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sorted.map((item) => (
                  <DrawerItemCard
                    key={item.id}
                    item={item}
                    fresh={item.id === freshId}
                    onClick={() => onItemClick(item)}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-dashed border-qd-line px-4 py-3 text-center text-xs leading-relaxed text-balance text-qd-muted dark:border-qd-line-dark dark:text-qd-muted-dark">
            답변의 단어를 클릭하거나 직접 질문을 적어 담아보세요
          </footer>
        </aside>
      )}
    </div>
  );
}
