import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConversationId, watchConversationId } from './conversation';

afterEach(() => {
  history.replaceState(null, '', '/');
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
  it('fires on pushState when the id changes', () => {
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.pushState(null, '', '/c/first');

    expect(cb).toHaveBeenCalledWith('first');
    stop();
  });

  it('fires on replaceState, which is how a new chat gains its id', () => {
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.replaceState(null, '', '/c/fresh');

    expect(cb).toHaveBeenCalledWith('fresh');
    stop();
  });

  it('fires on popstate when the user goes back', async () => {
    history.pushState(null, '', '/c/first');
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.pushState(null, '', '/c/second');
    cb.mockClear(); // pushState already reported 'second'
    history.back(); // jsdom fires popstate asynchronously

    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith('first'));
    stop();
  });

  it('does not fire when the id is unchanged', () => {
    history.replaceState(null, '', '/c/same');
    const cb = vi.fn();
    const stop = watchConversationId(cb);

    history.pushState(null, '', '/c/same?scrolled=1');

    expect(cb).not.toHaveBeenCalled();
    stop();
  });

  it('restores the original history methods when stopped', () => {
    const original = history.pushState;
    const stop = watchConversationId(() => {});
    stop();

    expect(history.pushState).toBe(original);
  });
});
