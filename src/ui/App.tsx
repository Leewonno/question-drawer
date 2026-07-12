import { useEffect, useRef } from 'react';
import { DrawerPanel } from './DrawerPanel';
import { SelectionButton } from './SelectionButton';
import { useConversationId } from './useConversationId';
import { createDrawerItem } from '@/src/lib/template';
import { drawerStorage } from '@/src/lib/storage';
import { getConversationId } from '@/src/lib/conversation';
import { getActiveAdapter, type SiteId } from '@/src/lib/site-adapter';
import { copyToClipboard, showToast } from '@/src/lib/fallback';
import { logger } from '@/src/lib/logger';
import type { DrawerItem } from '@/src/lib/schema';

export function App({ site }: { site: SiteId }) {
  const conversationId = useConversationId();
  const previousId = useRef(conversationId);

  // A fresh chat has no id until the first message is sent. Items captured in
  // that window are parked with conversationId: null — once the URL grows an id
  // they belong to this chat. Only on the null -> id transition: adopting on an
  // id -> id move would steal another chat's parked items.
  useEffect(() => {
    const previous = previousId.current;
    previousId.current = conversationId;
    if (previous !== null || conversationId === null) return;
    drawerStorage.adopt(site, conversationId).catch((error) => {
      logger.error('failed to adopt drawer items', error);
    });
  }, [conversationId, site]);

  const handleCapture = (text: string) => {
    drawerStorage
      .add(createDrawerItem(text, site, getConversationId()))
      .catch((error) => {
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
      <DrawerPanel site={site} onItemClick={handleItemClick} />
    </>
  );
}
