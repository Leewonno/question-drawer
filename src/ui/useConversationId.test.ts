import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useConversationId } from './useConversationId';

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('useConversationId', () => {
  it('starts with the id in the current url', () => {
    history.replaceState(null, '', '/c/chat-1');

    const { result } = renderHook(() => useConversationId());

    expect(result.current).toBe('chat-1');
  });

  it('is null on a new chat', () => {
    history.replaceState(null, '', '/new');

    const { result } = renderHook(() => useConversationId());

    expect(result.current).toBeNull();
  });

  it('updates when the SPA navigates to a conversation', () => {
    history.replaceState(null, '', '/new');
    const { result } = renderHook(() => useConversationId());

    act(() => {
      history.replaceState(null, '', '/c/chat-2');
    });

    expect(result.current).toBe('chat-2');
  });

  it('stops watching after unmount', () => {
    const original = history.pushState;
    const { unmount } = renderHook(() => useConversationId());

    unmount();

    expect(history.pushState).toBe(original);
  });
});
