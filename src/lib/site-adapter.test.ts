import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveAdapter } from './site-adapter';

describe('getActiveAdapter', () => {
  it('selects claude adapter on claude.ai', () => {
    expect(getActiveAdapter('claude.ai')?.id).toBe('claude');
  });
  it('selects chatgpt adapter on chatgpt.com', () => {
    expect(getActiveAdapter('chatgpt.com')?.id).toBe('chatgpt');
  });
  it('returns null on unknown hosts', () => {
    expect(getActiveAdapter('example.com')).toBeNull();
  });
});

describe('insertPrompt', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when no input box exists', () => {
    const adapter = getActiveAdapter('chatgpt.com')!;
    expect(adapter.insertPrompt('hello')).toBe(false);
  });

  it('inserts text into a contenteditable input and fires input event', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    el.id = 'prompt-textarea';
    document.body.append(el);
    let fired = false;
    el.addEventListener('input', () => { fired = true; });

    const adapter = getActiveAdapter('chatgpt.com')!;
    const ok = adapter.insertPrompt('hello world');

    expect(ok).toBe(true);
    expect(el.textContent).toContain('hello world');
    expect(fired).toBe(true);
  });
});
