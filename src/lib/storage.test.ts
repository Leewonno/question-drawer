import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import { drawerStorage } from './storage';
import type { DrawerItem } from './schema';

const item = (id: string, overrides: Partial<DrawerItem> = {}): DrawerItem => ({
  id,
  selectedText: 'side effect',
  question: 'side effect에 대해 자세히 설명해줘',
  site: 'claude',
  conversationId: 'chat-1',
  createdAt: 1,
  ...overrides,
});

describe('drawerStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns empty array when nothing stored', async () => {
    expect(await drawerStorage.getAll()).toEqual([]);
  });

  it('adds newest first and persists', async () => {
    await drawerStorage.add(item('a'));
    await drawerStorage.add(item('b'));
    const all = await drawerStorage.getAll();
    expect(all.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('removes by id', async () => {
    await drawerStorage.add(item('a'));
    await drawerStorage.add(item('b'));
    await drawerStorage.remove('a');
    expect((await drawerStorage.getAll()).map((i) => i.id)).toEqual(['b']);
  });

  it('recovers to empty when stored data is malformed', async () => {
    await storage.setItem('local:drawer', { items: [{ bad: true }] });
    expect(await drawerStorage.getAll()).toEqual([]);
  });

  it('watch fires callback with updated items and unwatch stops further callbacks', async () => {
    const calls: DrawerItem[][] = [];
    const unwatch = drawerStorage.watch((items) => {
      calls.push(items);
    });

    await drawerStorage.add(item('a'));
    expect(calls).toHaveLength(1);
    expect(calls[0].map((i) => i.id)).toEqual(['a']);

    unwatch();

    await drawerStorage.add(item('b'));
    expect(calls).toHaveLength(1);
  });

  it('drops pre-conversationId items, which fail validation', async () => {
    await storage.setItem('local:drawer', {
      items: [
        {
          id: 'legacy',
          selectedText: 'side effect',
          question: 'side effect에 대해 자세히 설명해줘',
          site: 'claude',
          createdAt: 1,
        },
      ],
    });

    expect(await drawerStorage.getAll()).toEqual([]);
  });
});

describe('drawerStorage.adopt', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('attaches the conversation id to items captured before the chat existed', async () => {
    await drawerStorage.add(item('pending', { conversationId: null }));

    await drawerStorage.adopt('claude', 'chat-fresh');

    const all = await drawerStorage.getAll();
    expect(all.map((i) => i.conversationId)).toEqual(['chat-fresh']);
  });

  it('leaves items that already belong to a conversation alone', async () => {
    await drawerStorage.add(item('owned', { conversationId: 'chat-old' }));

    await drawerStorage.adopt('claude', 'chat-new');

    const all = await drawerStorage.getAll();
    expect(all.map((i) => i.conversationId)).toEqual(['chat-old']);
  });

  it('leaves pending items from another site alone', async () => {
    await drawerStorage.add(item('elsewhere', { site: 'chatgpt', conversationId: null }));

    await drawerStorage.adopt('claude', 'chat-fresh');

    const all = await drawerStorage.getAll();
    expect(all.map((i) => i.conversationId)).toEqual([null]);
  });

  it('does not write when there is nothing to adopt', async () => {
    await drawerStorage.add(item('owned', { conversationId: 'chat-old' }));
    const calls: DrawerItem[][] = [];
    const unwatch = drawerStorage.watch((items) => {
      calls.push(items);
    });

    await drawerStorage.adopt('claude', 'chat-new');

    expect(calls).toEqual([]);
    unwatch();
  });
});
