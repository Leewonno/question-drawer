import type { DrawerItem } from './schema';

export function buildQuestion(selectedText: string): string {
  return `${selectedText.trim()}에 대해 자세히 설명해줘`;
}

export function createDrawerItem(
  selectedText: string,
  site: 'claude' | 'chatgpt',
  conversationId: string | null,
): DrawerItem {
  const text = selectedText.trim();
  return {
    id: crypto.randomUUID(),
    selectedText: text,
    question: buildQuestion(text),
    site,
    conversationId,
    createdAt: Date.now(),
  };
}

// A question typed by the user in the "+" modal is already the full question —
// no template is applied. selectedText mirrors it so the item shape stays whole.
export function createManualDrawerItem(
  question: string,
  site: 'claude' | 'chatgpt',
  conversationId: string | null,
): DrawerItem {
  const text = question.trim();
  return {
    id: crypto.randomUUID(),
    selectedText: text,
    question: text,
    site,
    conversationId,
    createdAt: Date.now(),
  };
}
