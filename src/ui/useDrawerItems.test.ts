import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { useDrawerItems } from './useDrawerItems';
import { drawerStorage } from '@/src/lib/storage';
import { createDrawerItem } from '@/src/lib/template';

describe('useDrawerItems', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('shows only the items captured in the current conversation', async () => {
    await drawerStorage.add(createDrawerItem('mine', 'claude', 'chat-1'));
    await drawerStorage.add(createDrawerItem('theirs', 'claude', 'chat-2'));

    const { result } = renderHook(() => useDrawerItems('claude', 'chat-1'));

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].selectedText).toBe('mine');
  });

  it('shows pending items on a new chat', async () => {
    await drawerStorage.add(createDrawerItem('pending', 'claude', null));
    await drawerStorage.add(createDrawerItem('owned', 'claude', 'chat-1'));

    const { result } = renderHook(() => useDrawerItems('claude', null));

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].selectedText).toBe('pending');
  });

  it('does not leak items across sites', async () => {
    await drawerStorage.add(createDrawerItem('elsewhere', 'chatgpt', 'chat-1'));

    const { result } = renderHook(() => useDrawerItems('claude', 'chat-1'));

    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it('swaps its items when the conversation changes', async () => {
    await drawerStorage.add(createDrawerItem('first', 'claude', 'chat-1'));
    await drawerStorage.add(createDrawerItem('second', 'claude', 'chat-2'));

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useDrawerItems('claude', id),
      { initialProps: { id: 'chat-1' } },
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    rerender({ id: 'chat-2' });

    await waitFor(() => expect(result.current.items[0].selectedText).toBe('second'));
  });
});
