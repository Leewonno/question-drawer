import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { drawerStorage } from './storage';
import type { DrawerItem } from './schema';

const item = (id: string): DrawerItem => ({
  id,
  selectedText: 'side effect',
  question: 'side effect에 대해 자세히 설명해줘',
  site: 'claude',
  createdAt: 1,
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
    await fakeBrowser.storage.local.set({ 'local:drawer': { items: [{ bad: true }] } });
    expect(await drawerStorage.getAll()).toEqual([]);
  });
});
