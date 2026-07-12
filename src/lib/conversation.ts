// Conversation id lives in the URL path, so it survives reloads and works in
// any tab: claude.ai/chat/<id>, chatgpt.com/c/<id>, chatgpt.com/g/<gizmo>/c/<id>.
// Matched by path shape only — the host is already narrowed by the content
// script's match patterns.
const PATTERNS = [/^\/chat\/([^/?#]+)/, /(?:^|\/)c\/([^/?#]+)/];

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

// Both sites swap the URL without a reload — sending the first message in a new
// chat turns /new into /chat/<id> via history. Patch pushState/replaceState and
// listen for popstate so we see it.
export function watchConversationId(cb: (id: string | null) => void): () => void {
  let current = getConversationId();

  const emit = () => {
    const next = getConversationId();
    if (next === current) return;
    current = next;
    cb(next);
  };

  const { pushState, replaceState } = history;

  history.pushState = function (
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    pushState.apply(this, args);
    emit();
  };
  history.replaceState = function (
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    replaceState.apply(this, args);
    emit();
  };
  window.addEventListener('popstate', emit);

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.removeEventListener('popstate', emit);
  };
}
