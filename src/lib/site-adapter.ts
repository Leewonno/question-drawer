import { logger } from './logger';

export type SiteId = 'claude' | 'chatgpt';

export interface SiteAdapter {
  id: SiteId;
  getInputBox(): HTMLElement | null;
  insertPrompt(text: string): boolean;
  // Whether a node lives inside an actual chat message (as opposed to the input
  // box, sidebar, settings, or our own UI). Gates the capture button.
  isWithinChat(node: Node | null): boolean;
}

// Prefer stable selectors (role/aria/element type) over obfuscated class names.
function firstMatch(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

// A node counts as "within chat" when it (or an ancestor) matches one of the
// message-container selectors. Positive matching naturally excludes the input
// box and page chrome, which never sit inside a message element.
function withinAny(node: Node | null, selectors: string[]): boolean {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  if (!el) return false;
  return selectors.some((sel) => el.closest(sel) !== null);
}

function setText(el: HTMLElement, text: string): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // contenteditable (ProseMirror): execCommand triggers the framework's
  // input handling; select all existing content first so the insert
  // REPLACES it rather than splicing into the caret position.
  // Fall back to manual textContent + input event.
  // Guard for environments (e.g. jsdom) where execCommand is unimplemented.
  const inserted =
    typeof document.execCommand === 'function' &&
    document.execCommand('selectAll', false) &&
    document.execCommand('insertText', false, text);
  if (!inserted) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }
}

const chatgpt: SiteAdapter = {
  id: 'chatgpt',
  getInputBox: () =>
    firstMatch([
      '#prompt-textarea',
      'div[contenteditable="true"]',
      'textarea[data-testid="prompt-textarea"]',
      'textarea',
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn('chatgpt input box not found');
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[data-message-author-role]',
      '[data-testid^="conversation-turn"]',
      '.markdown',
    ]),
};

const claude: SiteAdapter = {
  id: 'claude',
  getInputBox: () =>
    firstMatch([
      'div[contenteditable="true"]',
      'div[enterkeyhint][contenteditable]',
      'textarea',
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn('claude input box not found');
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[data-testid="user-message"]',
      '.font-claude-message',
      '[data-test-render-count]',
    ]),
};

export function getActiveAdapter(host: string = location.hostname): SiteAdapter | null {
  if (host === 'claude.ai' || host.endsWith('.claude.ai')) return claude;
  if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return chatgpt;
  return null;
}
