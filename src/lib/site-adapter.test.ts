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

  it('replaces a textarea value and fires an input event', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'prompt-textarea');
    textarea.value = 'existing draft text';
    document.body.append(textarea);
    let fired = false;
    textarea.addEventListener('input', () => { fired = true; });

    const adapter = getActiveAdapter('chatgpt.com')!;
    const ok = adapter.insertPrompt('hello world');

    expect(ok).toBe(true);
    expect(textarea.value).toBe('hello world');
    expect(fired).toBe(true);
  });

  it('replaces existing contenteditable content on claude.ai rather than concatenating', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    el.textContent = 'previously typed draft';
    document.body.append(el);

    const adapter = getActiveAdapter('claude.ai')!;
    const ok = adapter.insertPrompt('hello world');

    expect(ok).toBe(true);
    expect(el.textContent).toBe('hello world');
  });
});

describe('getActiveAdapter host matching', () => {
  it('rejects a spoofed host that merely ends with claude.ai', () => {
    expect(getActiveAdapter('evilclaude.ai')).toBeNull();
  });

  it('rejects a spoofed host that merely ends with chatgpt.com', () => {
    expect(getActiveAdapter('evilchatgpt.com')).toBeNull();
  });

  it('accepts legitimate subdomains', () => {
    expect(getActiveAdapter('chat.claude.ai')?.id).toBe('claude');
  });
});
