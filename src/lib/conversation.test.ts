import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConversationId, watchConversationId, POLL_MS } from './conversation';

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('getConversationId', () => {
  it('reads the id from a claude conversation url', () => {
    expect(getConversationId('https://claude.ai/chat/abc-123')).toBe('abc-123');
  });

  it('reads the id from a chatgpt conversation url', () => {
    expect(getConversationId('https://chatgpt.com/c/abc-123')).toBe('abc-123');
  });

  it('reads the id from a chatgpt GPTs conversation url', () => {
    expect(getConversationId('https://chatgpt.com/g/g-writer/c/abc-123')).toBe('abc-123');
  });

  it('reads the id from a gemini conversation url', () => {
    expect(getConversationId('https://gemini.google.com/app/abc-123')).toBe('abc-123');
  });

  it('reads the id from a deepseek conversation url', () => {
    expect(getConversationId('https://chat.deepseek.com/a/chat/s/abc-123')).toBe('abc-123');
  });

  it('reads the id from a grok conversation url, ignoring the rid query', () => {
    expect(getConversationId('https://grok.com/c/abc-123?rid=xyz')).toBe('abc-123');
  });

  it('ignores query strings and hashes', () => {
    expect(getConversationId('https://claude.ai/chat/abc-123?ref=x#top')).toBe('abc-123');
  });

  it('returns null on a new chat url', () => {
    expect(getConversationId('https://claude.ai/new')).toBeNull();
    expect(getConversationId('https://chatgpt.com/')).toBeNull();
  });

  it('returns null on an unknown path', () => {
    expect(getConversationId('https://claude.ai/settings/profile')).toBeNull();
  });

  it('falls back to the current location when no url is given', () => {
    history.replaceState(null, '', '/c/from-location');
    expect(getConversationId()).toBe('from-location');
  });
});

describe('watchConversationId', () => {
  // The site's router lives in the page's main world, where our history patches
  // would be invisible, so the URL can change with no event we can hook. Polling
  // is what actually catches a chat switch.
  it('notices a url the SPA swapped in without any event', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.pushState(null, '', '/c/first');
    expect(cb).not.toHaveBeenCalled(); // no event fires for pushState

    vi.advanceTimersByTime(POLL_MS);

    expect(cb).toHaveBeenCalledWith('first');
    stop();
  });

  it('notices a new chat gaining its id', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/new');
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.replaceState(null, '', '/c/fresh');
    vi.advanceTimersByTime(POLL_MS);

    expect(cb).toHaveBeenCalledWith('fresh');
    stop();
  });

  it('fires on popstate without waiting for the next poll', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    // popstate is an event, so it does cross into the content script's world.
    history.replaceState(null, '', '/c/back');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(cb).toHaveBeenCalledWith('back');
    stop();
  });

  it('does not fire when the id is unchanged', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/c/same');
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.pushState(null, '', '/c/same?scrolled=1');
    vi.advanceTimersByTime(POLL_MS * 3);

    expect(cb).not.toHaveBeenCalled();
    stop();
  });

  it('stops polling once unsubscribed', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    stop();
    history.pushState(null, '', '/c/after-stop');
    vi.advanceTimersByTime(POLL_MS * 3);

    expect(cb).not.toHaveBeenCalled();
  });
});
