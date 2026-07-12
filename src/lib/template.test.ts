import { describe, it, expect, vi } from 'vitest';
import { buildQuestion, createDrawerItem } from './template';

describe('buildQuestion', () => {
  it('wraps trimmed text in the default template', () => {
    expect(buildQuestion('  side effect  ')).toBe('side effect에 대해 자세히 설명해줘');
  });
});

describe('createDrawerItem', () => {
  it('builds a complete item', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111');
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const item = createDrawerItem('side effect', 'chatgpt', 'chat-1');
    expect(item).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      selectedText: 'side effect',
      question: 'side effect에 대해 자세히 설명해줘',
      site: 'chatgpt',
      conversationId: 'chat-1',
      createdAt: 42,
    });
  });

  it('keeps the conversation id null when the chat has none yet', () => {
    expect(createDrawerItem('side effect', 'chatgpt', null).conversationId).toBeNull();
  });
});
