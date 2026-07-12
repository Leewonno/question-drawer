import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useConversationId } from './useConversationId';
import { POLL_MS } from '@/src/lib/conversation';

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.useRealTimers();
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
    vi.useFakeTimers();
    history.replaceState(null, '', '/new');
    const { result } = renderHook(() => useConversationId());

    act(() => {
      history.replaceState(null, '', '/c/chat-2');
      vi.advanceTimersByTime(POLL_MS);
    });

    expect(result.current).toBe('chat-2');
  });

  it('stops watching after unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useConversationId());

    unmount();
    act(() => {
      history.replaceState(null, '', '/c/chat-3');
      vi.advanceTimersByTime(POLL_MS * 3);
    });

    expect(result.current).toBeNull();
  });
});
