# Question Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome (MV3) extension that lets users drag-select text in Claude/ChatGPT answers, drop it into a persistent right-side "drawer" as a templated follow-up question, and click drawer items to insert that question into the site's input box.

**Architecture:** A single content script injected into `claude.ai` and `chatgpt.com` renders a React drawer panel inside a Shadow DOM (style-isolated). A Selection Watcher detects drag selections and shows a floating "담기" button; clicking it runs a pure Question Template function and persists a `DrawerItem` via a Zod-validated `chrome.storage.local` wrapper. Site-specific DOM logic (finding the input box, inserting text) is isolated behind a Site Adapter interface with per-site implementations.

**Tech Stack:** WXT, React, TypeScript, Tailwind CSS, Zod, `wxt/utils/storage`, Vitest (unit), Playwright (E2E).

## Global Constraints

- Manifest V3 only.
- Target sites: `*://claude.ai/*` and `*://chatgpt.com/*`.
- Panel UI MUST render inside a Shadow DOM (no host-page CSS leakage in either direction).
- Persistence via `chrome.storage.local`; data survives browser restart.
- All persisted data validated with Zod on read and write.
- No raw `console.log` in committed code — use the `logger` module (Task 2).
- Judgment of "what is interesting" is the user's: the extension never auto-extracts concepts. No LLM/API calls in MVP.
- `DrawerItem` fields (exact): `id: string`, `selectedText: string`, `question: string`, `site: 'claude' | 'chatgpt'`, `createdAt: number`.

---

### Task 1: Project scaffold (WXT + React + Tailwind)

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `.gitignore`
- Create: `entrypoints/content/index.tsx` (placeholder)
- Create: `assets/tailwind.css`
- Create: `src/lib/logger.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable WXT project. `logger` export: `logger.warn(msg: string, ...args: unknown[]): void`, `logger.error(msg: string, ...args: unknown[]): void`, `logger.info(msg: string, ...args: unknown[]): void`.

- [ ] **Step 1: Initialize WXT with the React template**

Run (non-interactive; pick npm + react):
```bash
cd /Users/lwn/Desktop/projects/question-drawer
npx wxt@latest init . --template react --pm npm
npm install
```
If `init .` refuses because the directory is non-empty (the `docs/` folder), init into a temp subdir and move files:
```bash
npx wxt@latest init .wxt-tmp --template react --pm npm
cp -R .wxt-tmp/. . && rm -rf .wxt-tmp
npm install
```

- [ ] **Step 2: Add Tailwind, Zod, and the React module**

```bash
npm install zod
npm install -D tailwindcss @tailwindcss/postcss postcss @wxt-dev/module-react
```

Create `assets/tailwind.css`:
```css
@import "tailwindcss";
```

Create `postcss.config.mjs`:
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: Configure WXT (manifest + modules + matches)**

Overwrite `wxt.config.ts`:
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Question Drawer',
    description: 'Drag-select terms in Claude/ChatGPT answers and save follow-up questions.',
    permissions: ['storage', 'clipboardWrite'],
    host_permissions: ['*://claude.ai/*', '*://chatgpt.com/*'],
  },
});
```

- [ ] **Step 4: Add the logger module**

Create `src/lib/logger.ts`:
```typescript
const PREFIX = '[question-drawer]';

export const logger = {
  info: (msg: string, ...args: unknown[]) => console.info(`${PREFIX} ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`${PREFIX} ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`${PREFIX} ${msg}`, ...args),
};
```

- [ ] **Step 5: Add a placeholder content script scoped to the two sites**

Replace `entrypoints/content/index.tsx` (create the folder if the template used `content.ts`; delete the old file):
```tsx
import { logger } from '@/src/lib/logger';

export default defineContentScript({
  matches: ['*://claude.ai/*', '*://chatgpt.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    logger.info('content script loaded');
  },
});
```
Set the `@/*` path alias if not present — WXT's generated `tsconfig.json` extends `.wxt/tsconfig.json` which already maps `@/*` to the project root, so `@/src/lib/logger` resolves. Verify by opening `tsconfig.json`.

- [ ] **Step 6: Verify the project builds**

Run: `npx wxt build`
Expected: build succeeds, output written to `.output/chrome-mv3/` with a `manifest.json` containing the two host matches.

- [ ] **Step 7: Commit**

Add a `.gitignore` (if not created by init) containing `node_modules`, `.output`, `.wxt`, then:
```bash
git add -A
git commit -m "chore: scaffold WXT + React + Tailwind extension"
```

---

### Task 2: Storage schema and CRUD wrapper

**Files:**
- Create: `src/lib/schema.ts`
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`
- Create/Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `logger` (Task 1).
- Produces:
  - `DrawerItemSchema` (Zod), `DrawerItem` (type), `DrawerStateSchema`, `DrawerState = { items: DrawerItem[] }`.
  - `drawerStorage.getAll(): Promise<DrawerItem[]>`
  - `drawerStorage.add(item: DrawerItem): Promise<void>` — prepends (newest first).
  - `drawerStorage.remove(id: string): Promise<void>`
  - `drawerStorage.watch(cb: (items: DrawerItem[]) => void): () => void` — returns unwatch fn.

- [ ] **Step 1: Set up Vitest with WXT's plugin**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    mockReset: true,
    restoreMocks: true,
  },
});
```
Install test deps:
```bash
npm install -D vitest jsdom
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the Zod schema**

Create `src/lib/schema.ts`:
```typescript
import { z } from 'zod';

export const DrawerItemSchema = z.object({
  id: z.string(),
  selectedText: z.string(),
  question: z.string(),
  site: z.enum(['claude', 'chatgpt']),
  createdAt: z.number(),
});

export type DrawerItem = z.infer<typeof DrawerItemSchema>;

export const DrawerStateSchema = z.object({
  items: z.array(DrawerItemSchema),
});

export type DrawerState = z.infer<typeof DrawerStateSchema>;
```

- [ ] **Step 3: Write the failing storage test**

Create `src/lib/storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { drawerStorage } from './storage';
import type { DrawerItem } from './schema';

const item = (id: string): DrawerItem => ({
  id,
  selectedText: 'side effect',
  question: 'side effect에 대해 자세히 설명해줘',
  site: 'claude',
  createdAt: 1,
});

describe('drawerStorage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns empty array when nothing stored', async () => {
    expect(await drawerStorage.getAll()).toEqual([]);
  });

  it('adds newest first and persists', async () => {
    await drawerStorage.add(item('a'));
    await drawerStorage.add(item('b'));
    const all = await drawerStorage.getAll();
    expect(all.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('removes by id', async () => {
    await drawerStorage.add(item('a'));
    await drawerStorage.add(item('b'));
    await drawerStorage.remove('a');
    expect((await drawerStorage.getAll()).map((i) => i.id)).toEqual(['b']);
  });

  it('recovers to empty when stored data is malformed', async () => {
    await fakeBrowser.storage.local.set({ 'local:drawer': { items: [{ bad: true }] } });
    expect(await drawerStorage.getAll()).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — cannot import `./storage` (module not found).

- [ ] **Step 5: Implement the storage wrapper**

Create `src/lib/storage.ts`:
```typescript
import { storage } from 'wxt/utils/storage';
import { DrawerStateSchema, type DrawerItem, type DrawerState } from './schema';
import { logger } from './logger';

const KEY = 'local:drawer' as const;
const EMPTY: DrawerState = { items: [] };

async function read(): Promise<DrawerState> {
  const raw = await storage.getItem<unknown>(KEY);
  if (raw == null) return EMPTY;
  const parsed = DrawerStateSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('drawer state failed validation, resetting', parsed.error);
    return EMPTY;
  }
  return parsed.data;
}

async function write(state: DrawerState): Promise<void> {
  await storage.setItem(KEY, state);
}

export const drawerStorage = {
  async getAll(): Promise<DrawerItem[]> {
    return (await read()).items;
  },
  async add(item: DrawerItem): Promise<void> {
    const state = await read();
    await write({ items: [item, ...state.items] });
  },
  async remove(id: string): Promise<void> {
    const state = await read();
    await write({ items: state.items.filter((i) => i.id !== id) });
  },
  watch(cb: (items: DrawerItem[]) => void): () => void {
    return storage.watch<unknown>(KEY, (raw) => {
      const parsed = DrawerStateSchema.safeParse(raw ?? EMPTY);
      cb(parsed.success ? parsed.data.items : []);
    });
  },
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema.ts src/lib/storage.ts src/lib/storage.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add Zod-validated drawer storage wrapper"
```

---

### Task 3: Question Template

**Files:**
- Create: `src/lib/template.ts`
- Test: `src/lib/template.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildQuestion(selectedText: string): string` — trims input, applies the default template `` `${text}에 대해 자세히 설명해줘` ``.
  - `createDrawerItem(selectedText: string, site: 'claude' | 'chatgpt'): DrawerItem` — builds a full item with `id = crypto.randomUUID()`, `createdAt = Date.now()`, `question = buildQuestion(...)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/template.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildQuestion, createDrawerItem } from './template';

describe('buildQuestion', () => {
  it('wraps trimmed text in the default template', () => {
    expect(buildQuestion('  side effect  ')).toBe('side effect에 대해 자세히 설명해줘');
  });
});

describe('createDrawerItem', () => {
  it('builds a complete item', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-1111-1111-111111111111');
    vi.spyOn(Date, 'now').mockReturnValue(42);
    const item = createDrawerItem('side effect', 'chatgpt');
    expect(item).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      selectedText: 'side effect',
      question: 'side effect에 대해 자세히 설명해줘',
      site: 'chatgpt',
      createdAt: 42,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/template.test.ts`
Expected: FAIL — cannot import `./template`.

- [ ] **Step 3: Implement the template**

Create `src/lib/template.ts`:
```typescript
import type { DrawerItem } from './schema';

export function buildQuestion(selectedText: string): string {
  return `${selectedText.trim()}에 대해 자세히 설명해줘`;
}

export function createDrawerItem(
  selectedText: string,
  site: 'claude' | 'chatgpt',
): DrawerItem {
  const text = selectedText.trim();
  return {
    id: crypto.randomUUID(),
    selectedText: text,
    question: buildQuestion(text),
    site,
    createdAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/template.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/template.ts src/lib/template.test.ts
git commit -m "feat: add question template builder"
```

---

### Task 4: Site Adapter (Claude + ChatGPT)

**Files:**
- Create: `src/lib/site-adapter.ts`
- Test: `src/lib/site-adapter.test.ts`

**Interfaces:**
- Consumes: `logger` (Task 1).
- Produces:
  - `type SiteId = 'claude' | 'chatgpt'`
  - `interface SiteAdapter { id: SiteId; getInputBox(): HTMLElement | null; insertPrompt(text: string): boolean; }` — `insertPrompt` returns `true` on success, `false` if the input box was not found.
  - `getActiveAdapter(host = location.hostname): SiteAdapter | null` — returns the adapter matching the current hostname, or `null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/site-adapter.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/site-adapter.test.ts`
Expected: FAIL — cannot import `./site-adapter`.

- [ ] **Step 3: Implement the adapters**

Create `src/lib/site-adapter.ts`:
```typescript
import { logger } from './logger';

export type SiteId = 'claude' | 'chatgpt';

export interface SiteAdapter {
  id: SiteId;
  getInputBox(): HTMLElement | null;
  insertPrompt(text: string): boolean;
}

// Prefer stable selectors (role/aria/element type) over obfuscated class names.
function firstMatch(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
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
  // input handling; fall back to manual textContent + input event.
  const inserted = document.execCommand('insertText', false, text);
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
};

export function getActiveAdapter(host: string = location.hostname): SiteAdapter | null {
  if (host.endsWith('claude.ai')) return claude;
  if (host.endsWith('chatgpt.com')) return chatgpt;
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/site-adapter.test.ts`
Expected: PASS (5 tests). Note: jsdom supports `document.execCommand('insertText')` insertion into a focused contenteditable; if it returns false the fallback path sets `textContent` and the assertions still hold.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-adapter.ts src/lib/site-adapter.test.ts
git commit -m "feat: add site adapters for claude and chatgpt"
```

---

### Task 5: Clipboard fallback + toast helper

**Files:**
- Create: `src/lib/fallback.ts`
- Test: `src/lib/fallback.test.ts`

**Interfaces:**
- Consumes: `logger`.
- Produces:
  - `copyToClipboard(text: string): Promise<boolean>` — uses `navigator.clipboard.writeText`, returns success.
  - `showToast(message: string): void` — appends a self-removing toast element to `document.body` (plain DOM, outside the shadow root, auto-removed after 3s).

- [ ] **Step 1: Write the failing test**

Create `src/lib/fallback.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyToClipboard, showToast } from './fallback';

describe('copyToClipboard', () => {
  it('returns true when clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyToClipboard('hi')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('returns false when clipboard write throws', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    expect(await copyToClipboard('hi')).toBe(false);
  });
});

describe('showToast', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('adds a toast element to the body', () => {
    showToast('hello');
    expect(document.body.querySelector('[data-qd-toast]')?.textContent).toBe('hello');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/fallback.test.ts`
Expected: FAIL — cannot import `./fallback`.

- [ ] **Step 3: Implement the fallback helpers**

Create `src/lib/fallback.ts`:
```typescript
import { logger } from './logger';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.error('clipboard write failed', error);
    return false;
  }
}

export function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.setAttribute('data-qd-toast', '');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(20,20,20,0.92)',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    zIndex: '2147483647',
  });
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/fallback.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fallback.ts src/lib/fallback.test.ts
git commit -m "feat: add clipboard fallback and toast helper"
```

---

### Task 6: Drawer Panel React component

**Files:**
- Create: `src/ui/DrawerPanel.tsx`
- Create: `src/ui/useDrawerItems.ts`
- Test: `src/ui/DrawerPanel.test.tsx`

**Interfaces:**
- Consumes: `drawerStorage` (Task 2), `DrawerItem` (Task 2).
- Produces:
  - `useDrawerItems(): { items: DrawerItem[]; remove: (id: string) => void }` — loads on mount, subscribes via `drawerStorage.watch`.
  - `<DrawerPanel onItemClick={(item: DrawerItem) => void} />` — renders the list; each item shows `question`, a delete button, and calls `onItemClick` when the item body is clicked. Collapsible via an internal toggle.

- [ ] **Step 1: Install React Testing Library**

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```
Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```
Add `setupFiles: ['./vitest.setup.ts']` to the `test` block in `vitest.config.ts`.

- [ ] **Step 2: Write the failing test**

Create `src/ui/DrawerPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing';
import { DrawerPanel } from './DrawerPanel';
import { drawerStorage } from '@/src/lib/storage';
import { createDrawerItem } from '@/src/lib/template';

describe('DrawerPanel', () => {
  beforeEach(() => fakeBrowser.reset());

  it('renders stored questions and fires onItemClick', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude'));
    const onItemClick = vi.fn();
    render(<DrawerPanel onItemClick={onItemClick} />);

    const item = await screen.findByText('side effect에 대해 자세히 설명해줘');
    await userEvent.click(item);
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });

  it('removes an item when its delete button is clicked', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude'));
    render(<DrawerPanel onItemClick={() => {}} />);

    await screen.findByText('side effect에 대해 자세히 설명해줘');
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(screen.queryByText('side effect에 대해 자세히 설명해줘')).toBeNull(),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/ui/DrawerPanel.test.tsx`
Expected: FAIL — cannot import `./DrawerPanel`.

- [ ] **Step 4: Implement the hook and component**

Create `src/ui/useDrawerItems.ts`:
```typescript
import { useEffect, useState } from 'react';
import { drawerStorage } from '@/src/lib/storage';
import type { DrawerItem } from '@/src/lib/schema';

export function useDrawerItems() {
  const [items, setItems] = useState<DrawerItem[]>([]);

  useEffect(() => {
    let active = true;
    drawerStorage.getAll().then((loaded) => {
      if (active) setItems(loaded);
    });
    const unwatch = drawerStorage.watch(setItems);
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const remove = (id: string) => {
    void drawerStorage.remove(id);
  };

  return { items, remove };
}
```

Create `src/ui/DrawerPanel.tsx`:
```tsx
import { useState } from 'react';
import { useDrawerItems } from './useDrawerItems';
import type { DrawerItem } from '@/src/lib/schema';

interface Props {
  onItemClick: (item: DrawerItem) => void;
}

export function DrawerPanel({ onItemClick }: Props) {
  const { items, remove } = useDrawerItems();
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed right-0 top-1/4 z-[2147483647] w-72 font-sans">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-l-md bg-neutral-800 px-3 py-1 text-sm text-white"
      >
        서랍 {items.length > 0 && `(${items.length})`}
      </button>
      {open && (
        <div className="max-h-[60vh] overflow-y-auto rounded-l-md bg-white p-2 shadow-lg dark:bg-neutral-900">
          {items.length === 0 && (
            <p className="p-3 text-sm text-neutral-500">담긴 질문이 없어요.</p>
          )}
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <button
                  onClick={() => onItemClick(item)}
                  className="flex-1 text-left text-sm text-neutral-800 dark:text-neutral-100"
                >
                  {item.question}
                </button>
                <button
                  aria-label="삭제"
                  onClick={() => remove(item.id)}
                  className="text-neutral-400 hover:text-red-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/DrawerPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ui/DrawerPanel.tsx src/ui/useDrawerItems.ts src/ui/DrawerPanel.test.tsx vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat: add drawer panel component"
```

---

### Task 7: Selection Watcher ("담기" floating button)

**Files:**
- Create: `src/ui/SelectionButton.tsx`
- Test: `src/ui/SelectionButton.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure React + DOM selection).
- Produces:
  - `<SelectionButton onCapture={(text: string) => void} />` — listens for `mouseup`/`selectionchange` on `document`; when a non-empty text selection exists, renders a floating "서랍에 담기" button near the selection end. Clicking it calls `onCapture(selectedText)` and clears the selection. Hides when selection is empty.

- [ ] **Step 1: Write the failing test**

Create `src/ui/SelectionButton.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionButton } from './SelectionButton';

function selectText(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('SelectionButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '<p id="answer">side effect</p>';
    window.getSelection()?.removeAllRanges();
  });

  it('is hidden when there is no selection', () => {
    render(<SelectionButton onCapture={() => {}} />);
    expect(screen.queryByRole('button', { name: '서랍에 담기' })).toBeNull();
  });

  it('shows after selecting text and calls onCapture on click', async () => {
    const onCapture = vi.fn();
    render(<SelectionButton onCapture={onCapture} />);

    selectText(document.getElementById('answer')!);
    fireEvent.mouseUp(document);

    const btn = await screen.findByRole('button', { name: '서랍에 담기' });
    await userEvent.click(btn);
    expect(onCapture).toHaveBeenCalledWith('side effect');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/SelectionButton.test.tsx`
Expected: FAIL — cannot import `./SelectionButton`.

- [ ] **Step 3: Implement the component**

Create `src/ui/SelectionButton.tsx`:
```tsx
import { useEffect, useState } from 'react';

interface Props {
  onCapture: (text: string) => void;
}

interface Pos {
  text: string;
  x: number;
  y: number;
}

export function SelectionButton({ onCapture }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || sel.rangeCount === 0 || text === '') {
        setPos(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setPos({ text, x: rect.right, y: rect.bottom });
    };
    document.addEventListener('mouseup', update);
    document.addEventListener('selectionchange', update);
    return () => {
      document.removeEventListener('mouseup', update);
      document.removeEventListener('selectionchange', update);
    };
  }, []);

  if (!pos) return null;

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onCapture(pos.text);
        window.getSelection()?.removeAllRanges();
        setPos(null);
      }}
      style={{ position: 'fixed', left: pos.x, top: pos.y + 4, zIndex: 2147483647 }}
      className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-white shadow"
    >
      서랍에 담기
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/SelectionButton.test.tsx`
Expected: PASS (2 tests). Note: jsdom returns zeros from `getBoundingClientRect`, which is fine — the test only checks visibility and the capture callback.

- [ ] **Step 5: Commit**

```bash
git add src/ui/SelectionButton.tsx src/ui/SelectionButton.test.tsx
git commit -m "feat: add selection capture button"
```

---

### Task 8: Wire the content script (Shadow DOM mount + glue)

**Files:**
- Create: `src/ui/App.tsx`
- Modify: `entrypoints/content/index.tsx`
- Create: `entrypoints/content/style.css`

**Interfaces:**
- Consumes: `DrawerPanel` (Task 6), `SelectionButton` (Task 7), `createDrawerItem` (Task 3), `drawerStorage` (Task 2), `getActiveAdapter` (Task 4), `copyToClipboard`/`showToast` (Task 5).
- Produces: the mounted extension. `<App site={SiteId} />` composes `SelectionButton` (→ save item) and `DrawerPanel` (→ insert prompt with fallback).

- [ ] **Step 1: Implement the App composition root**

Create `src/ui/App.tsx`:
```tsx
import { DrawerPanel } from './DrawerPanel';
import { SelectionButton } from './SelectionButton';
import { createDrawerItem } from '@/src/lib/template';
import { drawerStorage } from '@/src/lib/storage';
import { getActiveAdapter, type SiteId } from '@/src/lib/site-adapter';
import { copyToClipboard, showToast } from '@/src/lib/fallback';
import type { DrawerItem } from '@/src/lib/schema';

export function App({ site }: { site: SiteId }) {
  const handleCapture = (text: string) => {
    void drawerStorage.add(createDrawerItem(text, site));
  };

  const handleItemClick = async (item: DrawerItem) => {
    const adapter = getActiveAdapter();
    if (adapter?.insertPrompt(item.question)) return;
    const copied = await copyToClipboard(item.question);
    showToast(copied ? '입력창을 못 찾아 클립보드에 복사했어요' : '삽입에 실패했어요');
  };

  return (
    <>
      <SelectionButton onCapture={handleCapture} />
      <DrawerPanel onItemClick={handleItemClick} />
    </>
  );
}
```

- [ ] **Step 2: Wire the content script with a Shadow Root UI**

Create `entrypoints/content/style.css`:
```css
@import "tailwindcss";
```

Overwrite `entrypoints/content/index.tsx`:
```tsx
import './style.css';
import ReactDOM from 'react-dom/client';
import { App } from '@/src/ui/App';
import { getActiveAdapter } from '@/src/lib/site-adapter';
import { logger } from '@/src/lib/logger';

export default defineContentScript({
  matches: ['*://claude.ai/*', '*://chatgpt.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const adapter = getActiveAdapter();
    if (!adapter) {
      logger.warn('no adapter for host, skipping mount');
      return;
    }
    const ui = await createShadowRootUi(ctx, {
      name: 'question-drawer-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<App site={adapter.id} />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
```

- [ ] **Step 3: Verify the build**

Run: `npx wxt build`
Expected: build succeeds; `.output/chrome-mv3/manifest.json` lists the content script for both hosts and the `storage` + `clipboardWrite` permissions.

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: all tests from Tasks 2–7 PASS.

- [ ] **Step 5: Manual smoke test (documented, run by human)**

```bash
npx wxt dev
```
Load the dev extension in Chrome, open `claude.ai` and `chatgpt.com`:
1. Drag-select a phrase in an answer → "서랍에 담기" appears → click → item shows in the right panel.
2. Reload the page → item persists.
3. Click the item → question text appears in the input box.
4. Temporarily break the adapter selectors to confirm the clipboard-copy toast fallback.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/content/index.tsx entrypoints/content/style.css src/ui/App.tsx
git commit -m "feat: wire content script with shadow-root drawer UI"
```

---

### Task 9: Playwright E2E scaffold (critical flow)

**Files:**
- Create: `e2e/drawer.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json` (add `"e2e": "playwright test"`)

**Interfaces:**
- Consumes: the built extension in `.output/chrome-mv3`.
- Produces: an E2E test that loads the extension via a persistent context and verifies the capture→persist→insert flow against a local fixture page (no login required for CI); a documented (skipped) live-site test.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create the config**

Create `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { headless: false },
});
```

- [ ] **Step 3: Write the E2E test against a local fixture**

Create `e2e/drawer.spec.ts`:
```typescript
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve(__dirname, '../.output/chrome-mv3');

// Fixture mimics chatgpt.com's input box so the adapter resolves without login.
// A live-site flow requires a logged-in session and is documented as manual.
let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('captures a selection and inserts the question', async () => {
  const page = await context.newPage();
  // The extension only matches claude.ai / chatgpt.com; route a fake chatgpt page.
  await page.route('*://chatgpt.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body>
        <p id="answer">side effect</p>
        <div id="prompt-textarea" contenteditable="true"></div>
      </body></html>`,
    }),
  );
  await page.goto('https://chatgpt.com/');

  await page.getByText('side effect').selectText();
  await page.dispatchEvent('body', 'mouseup');

  // The button lives in the extension's shadow root.
  const host = page.locator('question-drawer-ui');
  await host.getByRole('button', { name: '서랍에 담기' }).click();

  const item = host.getByText('side effect에 대해 자세히 설명해줘');
  await expect(item).toBeVisible();

  await item.click();
  await expect(page.locator('#prompt-textarea')).toContainText('side effect에 대해 자세히 설명해줘');
});
```

- [ ] **Step 4: Build then run the E2E test**

Run:
```bash
npx wxt build
npx playwright test
```
Expected: the test PASSES (headed Chromium with the extension loaded). If shadow-root piercing needs adjustment, target `question-drawer-ui` host + inner text; Playwright pierces open shadow roots by default.

- [ ] **Step 5: Commit**

```bash
git add e2e/drawer.spec.ts playwright.config.ts package.json package-lock.json
git commit -m "test: add playwright e2e for capture-to-insert flow"
```

---

## Notes for the implementer

- **Selector fragility:** The `getInputBox` selector lists in Task 4 are best-effort and WILL drift as Claude/ChatGPT change their DOM. When the manual smoke test (Task 8 Step 5) shows insertion failing, update only `src/lib/site-adapter.ts` — nothing else should need to change. Prefer `role`, `aria-label`, `contenteditable`, and element-type selectors over obfuscated class names.
- **execCommand deprecation:** `document.execCommand('insertText')` is deprecated but remains the most reliable way to insert into ProseMirror-based editors so the framework registers the change. The fallback path handles environments where it returns false.
- **Future (post-MVP):** LLM smart-question generation is out of scope; when added, use BYOK (user-supplied API key), never the logged-in web session (ToS/ban risk). Keep it behind the existing `buildQuestion` interface.
```
