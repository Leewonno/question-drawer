import { logger } from "./logger";

export type SiteId =
  | "claude"
  | "chatgpt"
  | "kimi"
  | "gemini"
  | "deepseek"
  | "grok";

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
      "value",
    )?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  // contenteditable (ProseMirror): execCommand triggers the framework's
  // input handling; select all existing content first so the insert
  // REPLACES it rather than splicing into the caret position.
  // Fall back to manual textContent + input event.
  // Guard for environments (e.g. jsdom) where execCommand is unimplemented.
  const inserted =
    typeof document.execCommand === "function" &&
    document.execCommand("selectAll", false) &&
    document.execCommand("insertText", false, text);
  if (!inserted) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  }
}

const chatgpt: SiteAdapter = {
  id: "chatgpt",
  getInputBox: () =>
    firstMatch([
      "#prompt-textarea",
      'div[contenteditable="true"]',
      'textarea[data-testid="prompt-textarea"]',
      "textarea",
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("chatgpt input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      "[data-message-author-role]",
      '[data-testid^="conversation-turn"]',
      ".markdown",
    ]),
};

const claude: SiteAdapter = {
  id: "claude",
  getInputBox: () =>
    firstMatch([
      'div[contenteditable="true"]',
      "div[enterkeyhint][contenteditable]",
      "textarea",
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("claude input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[data-testid="user-message"]',
      ".font-claude-message",
      "[data-test-render-count]",
    ]),
};

// Kimi (Moonshot AI). Served from www.kimi.com; conversation URLs are
// /chat/<id>, which the shared conversation.ts pattern already handles.
// NOTE: getInputBox and isWithinChat selectors below are best-effort and should
// be verified against the live DOM — Kimi ships an obfuscated build, so the
// generic contenteditable/textarea fallback and the class-substring matchers
// may need tightening once inspected on the real page.
const kimi: SiteAdapter = {
  id: "kimi",
  getInputBox: () =>
    firstMatch([
      'div[contenteditable="true"]',
      ".chat-input-editor",
      'textarea[data-testid="msh-chatinput"]',
      "textarea",
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("kimi input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[class*="segment-assistant"]',
      '[class*="chat-content-item"]',
      ".markdown",
    ]),
};

// Google Gemini. Served from gemini.google.com; conversation URLs are
// /app/<id>, handled by the shared conversation.ts pattern. The input is a
// Quill editor (div.ql-editor[contenteditable]) wrapped in <rich-textarea>.
// NOTE: getInputBox and isWithinChat selectors are best-effort and should be
// verified against the live DOM — Gemini ships an Angular build with its own
// custom elements (<message-content>, <user-query>), so the class-substring
// matchers may need tightening once inspected on the real page.
const gemini: SiteAdapter = {
  id: "gemini",
  getInputBox: () =>
    firstMatch([
      "rich-textarea div.ql-editor[contenteditable]",
      "div.ql-editor[contenteditable]",
      'div[contenteditable="true"]',
      "textarea",
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("gemini input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      "message-content",
      "user-query",
      '[class*="model-response"]',
      ".markdown",
    ]),
};

// DeepSeek. Served from chat.deepseek.com; conversation URLs are
// /a/chat/s/<id>, handled by the shared conversation.ts pattern. The input is a
// plain <textarea id="chat-input">; answers render into .ds-markdown.
// NOTE: getInputBox and isWithinChat selectors are best-effort and should be
// verified against the live DOM — DeepSeek ships an obfuscated build, so the
// class-substring matchers may need tightening once inspected on the real page.
const deepseek: SiteAdapter = {
  id: "deepseek",
  getInputBox: () =>
    firstMatch([
      "textarea#chat-input",
      'div[contenteditable="true"]',
      "textarea",
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("deepseek input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[class*="ds-markdown"]',
      ".ds-markdown",
      ".markdown",
    ]),
};

// Grok (xAI). Served from grok.com; conversation URLs are /c/<id>, handled by
// the shared conversation.ts pattern. The composer is a plain <textarea>;
// answers render into a markdown container.
// NOTE: getInputBox and isWithinChat selectors are best-effort and should be
// verified against the live DOM — Grok ships an obfuscated build, so the
// class-substring matchers may need tightening once inspected on the real page.
const grok: SiteAdapter = {
  id: "grok",
  getInputBox: () =>
    firstMatch([
      "textarea",
      'div[contenteditable="true"]',
    ]),
  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      logger.warn("grok input box not found");
      return false;
    }
    setText(box, text);
    return true;
  },
  isWithinChat: (node) =>
    withinAny(node, [
      '[class*="message-bubble"]',
      '[class*="response-content"]',
      ".markdown",
    ]),
};

export function getActiveAdapter(
  host: string = location.hostname,
): SiteAdapter | null {
  if (host === "claude.ai" || host.endsWith(".claude.ai")) return claude;
  if (host === "chatgpt.com" || host.endsWith(".chatgpt.com")) return chatgpt;
  if (host === "kimi.com" || host.endsWith(".kimi.com")) return kimi;
  if (host === "gemini.google.com") return gemini;
  if (host === "deepseek.com" || host.endsWith(".deepseek.com"))
    return deepseek;
  if (host === "grok.com" || host.endsWith(".grok.com")) return grok;
  return null;
}
