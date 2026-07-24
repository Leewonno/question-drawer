// Conversation id lives in the URL path, so it survives reloads and works in
// any tab: claude.ai/chat/<id>, chatgpt.com/c/<id>, chatgpt.com/g/<gizmo>/c/<id>,
// kimi.com/chat/<id>, gemini.google.com/app/<id>, deepseek.com/a/chat/s/<id>.
// Matched by path shape only — the host is already narrowed by the content
// script's match patterns.
const PATTERNS = [
  /^\/chat\/([^/?#]+)/,
  /(?:^|\/)c\/([^/?#]+)/,
  /^\/app\/([^/?#]+)/,
  /^\/a\/chat\/s\/([^/?#]+)/,
];

export const POLL_MS = 400;

export function getConversationId(url: string = location.href): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, location.href).pathname;
  } catch {
    return null;
  }
  for (const pattern of PATTERNS) {
    const match = pathname.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Switching chats is a pushState, which fires no event. Patching history is no
// help either: this runs in the content script's isolated world, so the page's
// own history object — the one the site's router calls — is untouched by it.
// Polling the URL is what actually sees the switch. popstate IS delivered here,
// so back/forward lands without waiting for the next tick.
export function watchConversationId(
  cb: (id: string | null) => void,
): () => void {
  let current = getConversationId();

  const emit = () => {
    const next = getConversationId();
    if (next === current) return;
    current = next;
    cb(next);
  };

  const timer = setInterval(emit, POLL_MS);
  window.addEventListener("popstate", emit);

  return () => {
    clearInterval(timer);
    window.removeEventListener("popstate", emit);
  };
}
