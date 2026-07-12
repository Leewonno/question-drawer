import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFreshItemId, FRESH_MS } from './useFreshItemId';
import type { DrawerItem } from '@/src/lib/schema';

function item(createdAt: number): DrawerItem {
  return {
    id: 'a1',
    selectedText: 'side effect',
    question: 'side effect에 대해 자세히 설명해줘',
    site: 'claude',
    conversationId: 'chat-1',
    createdAt,
  };
}

describe('useFreshItemId', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null when there is no item', () => {
    const { result } = renderHook(() => useFreshItemId(undefined));
    expect(result.current).toBeNull();
  });

  it('highlights an item that was just added', () => {
    const fresh = item(Date.now());
    const { result } = renderHook(() => useFreshItemId(fresh));
    expect(result.current).toBe('a1');
  });

  it('stops highlighting after the freshness window elapses', () => {
    const fresh = item(Date.now());
    const { result } = renderHook(() => useFreshItemId(fresh));
    expect(result.current).toBe('a1');

    act(() => {
      vi.advanceTimersByTime(FRESH_MS + 1);
    });

    expect(result.current).toBeNull();
  });

  it('does not highlight an item stored in a previous session', () => {
    const old = item(Date.now() - FRESH_MS - 1);
    const { result } = renderHook(() => useFreshItemId(old));
    expect(result.current).toBeNull();
  });
});
