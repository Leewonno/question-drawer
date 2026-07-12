import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { App } from './App';
import { drawerStorage } from '@/src/lib/storage';
import { createDrawerItem } from '@/src/lib/template';

describe('App conversation adoption', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('adopts pending items when the new chat gains a conversation id', async () => {
    await drawerStorage.add(createDrawerItem('pending', 'claude', null));
    render(<App site="claude" />);

    act(() => {
      history.replaceState(null, '', '/chat/chat-1');
    });

    await waitFor(async () => {
      const items = await drawerStorage.getAll();
      expect(items.map((i) => i.conversationId)).toEqual(['chat-1']);
    });
  });

  it('does not adopt when moving between existing conversations', async () => {
    history.replaceState(null, '', '/chat/chat-1');
    await drawerStorage.add(createDrawerItem('pending', 'claude', null));
    render(<App site="claude" />);

    act(() => {
      history.replaceState(null, '', '/chat/chat-2');
    });

    await waitFor(async () => {
      const items = await drawerStorage.getAll();
      expect(items.map((i) => i.conversationId)).toEqual([null]);
    });
  });
});
