import { DrawerPanel } from './DrawerPanel';
import { SelectionButton } from './SelectionButton';
import { createDrawerItem } from '@/src/lib/template';
import { drawerStorage } from '@/src/lib/storage';
import { getActiveAdapter, type SiteId } from '@/src/lib/site-adapter';
import { copyToClipboard, showToast } from '@/src/lib/fallback';
import { logger } from '@/src/lib/logger';
import type { DrawerItem } from '@/src/lib/schema';

export function App({ site }: { site: SiteId }) {
  const handleCapture = (text: string) => {
    drawerStorage.add(createDrawerItem(text, site)).catch((error) => {
      logger.error('failed to save drawer item', error);
      showToast('저장에 실패했어요');
    });
  };

  const handleItemClick = async (item: DrawerItem) => {
    const adapter = getActiveAdapter();
    if (adapter?.insertPrompt(item.question)) return;
    const copied = await copyToClipboard(item.question);
    showToast(copied ? '입력창을 못 찾아 클립보드에 복사했어요' : '삽입에 실패했어요');
  };

  return (
    <>
      <SelectionButton onCapture={handleCapture} />
      <DrawerPanel onItemClick={handleItemClick} />
    </>
  );
}
