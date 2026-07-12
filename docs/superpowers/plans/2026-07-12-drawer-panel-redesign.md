# 드로어 패널 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 우측에 떠 있는 회색 드로어 박스를, 페이지를 밀어내고 도킹되는 앰버 톤 사이드바(다크 변형 포함)로 교체한다.

**Architecture:** 패널은 shadow root 안에서 `position: fixed`로 우측 전체 높이를 차지한다. 페이지 밀어내기는 host 문서 `<head>`에 주입한 스타일시트 한 장 + `<html>`의 `qd-docked` 클래스 토글로만 처리한다(실패해도 패널은 오버레이로 계속 동작). 다크 모드는 OS 설정이 아니라 host 페이지의 테마 표식(`<html>`의 class/data 속성)을 `MutationObserver`로 따라간다.

**Tech Stack:** WXT, React 19, Tailwind CSS v4, Zod, Vitest + @testing-library/react + `wxt/testing` fakeBrowser, Playwright.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-12-drawer-panel-redesign-design.md`
- 캡처 방식(드래그 선택 → "서랍에 담기")과 삽입 동작(카드 클릭 → 프롬프트 삽입)은 **변경 금지**. `SelectionButton.tsx`, `src/lib/storage.ts`, `src/lib/template.ts`, `src/lib/schema.ts`는 건드리지 않는다.
- 스토리지 스키마에 새 필드를 추가하지 않는다.
- `console.log` 금지. 로깅은 `src/lib/logger.ts`의 `logger`를 쓴다.
- 코드 스타일: single quote, 세미콜론. 기존 파일과 동일.
- z-index는 반드시 `z-[2147483647]` (대괄호 없는 `z-2147483647`은 Tailwind에서 무효한 클래스라 z-index가 적용되지 않는다).
- 패널 너비: 320px. 상수는 `DRAWER_WIDTH_PX` 하나만 쓴다.
- "방금 담김" 유지 시간: 8000ms. 상수는 `FRESH_MS` 하나만 쓴다.
- 한국어 문구는 아래 값을 그대로 쓴다.
  - 헤더 제목: `질문서랍`
  - 헤더 부제(항목 있을 때): `떠오른 질문 N개 · 클릭하면 바로 질문` (N은 개수)
  - 헤더 부제(항목 없을 때): `클릭 한 번으로 질문을 담아두세요`
  - 빈 상태: `답변에서 궁금한 부분을 드래그해 담아보세요`
  - 푸터: `답변의 단어를 클릭하거나 직접 질문을 적어 담아보세요`
  - "방금 담김" 라벨: `방금 담김`
  - 삭제 버튼 `aria-label`: `삭제` (기존 테스트가 이 이름에 의존한다)
  - 손잡이 탭 `aria-label`: 열림 상태일 때 `서랍 닫기`, 닫힘 상태일 때 `서랍 열기`
- 각 태스크는 `npx vitest run <해당 테스트 파일>`이 통과한 뒤 커밋한다.

---

### Task 1: 호스트 테마 감지

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export type HostTheme = 'light' | 'dark'`
  - `export function detectHostTheme(root?: HTMLElement): HostTheme` — 기본 인자 `document.documentElement`
  - `export function useHostTheme(): HostTheme`

- [ ] **Step 1: Write the failing test**

`src/lib/theme.test.ts`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { detectHostTheme, useHostTheme } from './theme';

function makeRoot(setup: (el: HTMLElement) => void): HTMLElement {
  const el = document.createElement('html');
  setup(el);
  return el;
}

describe('detectHostTheme', () => {
  it('reads the dark class', () => {
    expect(detectHostTheme(makeRoot((el) => el.classList.add('dark')))).toBe('dark');
  });

  it('reads the light class', () => {
    expect(detectHostTheme(makeRoot((el) => el.classList.add('light')))).toBe('light');
  });

  it('reads data-theme', () => {
    expect(detectHostTheme(makeRoot((el) => el.setAttribute('data-theme', 'dark')))).toBe('dark');
  });

  it('reads data-mode', () => {
    expect(detectHostTheme(makeRoot((el) => el.setAttribute('data-mode', 'dark')))).toBe('dark');
  });

  it('falls back to light when no marker is present and matchMedia is unavailable', () => {
    expect(detectHostTheme(makeRoot(() => {}))).toBe('light');
  });
});

describe('useHostTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
  });

  it('tracks the host page toggling its theme', async () => {
    const { result } = renderHook(() => useHostTheme());
    expect(result.current).toBe('light');

    await act(async () => {
      document.documentElement.classList.add('dark');
      // MutationObserver callbacks are delivered as microtasks.
      await Promise.resolve();
    });

    expect(result.current).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — `Failed to resolve import "./theme"`

- [ ] **Step 3: Write minimal implementation**

`src/lib/theme.ts`:

```ts
import { useEffect, useState } from 'react';

export type HostTheme = 'light' | 'dark';

// claude.ai and ChatGPT both expose their in-app theme on <html>, but with
// different markers. Read the explicit marker first; the OS preference is only
// a fallback because either site can be dark while the OS is light.
function fromMarkers(root: HTMLElement): HostTheme | null {
  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  const attr = root.getAttribute('data-theme') ?? root.getAttribute('data-mode');
  if (attr === 'dark') return 'dark';
  if (attr === 'light') return 'light';
  return null;
}

export function detectHostTheme(root: HTMLElement = document.documentElement): HostTheme {
  const marked = fromMarkers(root);
  if (marked) return marked;
  // jsdom doesn't implement matchMedia; real browsers do.
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useHostTheme(): HostTheme {
  const [theme, setTheme] = useState<HostTheme>(() => detectHostTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(detectHostTheme(root)));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-mode'],
    });
    setTheme(detectHostTheme(root));
    return () => observer.disconnect();
  }, []);

  return theme;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: detect host page theme for drawer dark mode"
```

---

### Task 2: 페이지 밀어내기(도킹)

**Files:**
- Create: `src/lib/dock.ts`
- Test: `src/lib/dock.test.ts`
- Modify: `src/lib/site-adapter.ts` (`SiteAdapter` 인터페이스에 `layoutCss?: string` 추가)
- Modify: `entrypoints/content/index.tsx` (언마운트 시 `cleanupDock()`)

**Interfaces:**
- Consumes: `getActiveAdapter()` from `src/lib/site-adapter.ts`, `logger` from `src/lib/logger.ts`
- Produces:
  - `export const DRAWER_WIDTH_PX = 320`
  - `export const DOCK_CLASS = 'qd-docked'`
  - `export function applyDock(open: boolean, layoutCss?: string): void` — `layoutCss` 기본값은 활성 adapter의 `layoutCss ?? ''`
  - `export function cleanupDock(): void`

- [ ] **Step 1: Write the failing test**

`src/lib/dock.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { applyDock, cleanupDock, DOCK_CLASS, DRAWER_WIDTH_PX } from './dock';

const STYLE_ID = 'question-drawer-dock';

afterEach(() => cleanupDock());

describe('applyDock', () => {
  it('injects the stylesheet once and marks html when open', () => {
    applyDock(true);
    applyDock(true);

    const styles = document.querySelectorAll(`#${STYLE_ID}`);
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain(`margin-right: ${DRAWER_WIDTH_PX}px`);
    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(true);
  });

  it('unmarks html when closed but leaves the stylesheet in place', () => {
    applyDock(true);
    applyDock(false);

    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });

  it('appends site-specific layout css', () => {
    applyDock(true, 'html.qd-docked .composer { right: 320px; }');

    expect(document.getElementById(STYLE_ID)?.textContent).toContain('.composer');
  });
});

describe('cleanupDock', () => {
  it('removes both the class and the stylesheet', () => {
    applyDock(true);
    cleanupDock();

    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false);
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dock.test.ts`
Expected: FAIL — `Failed to resolve import "./dock"`

- [ ] **Step 3: Write minimal implementation**

`src/lib/dock.ts`:

```ts
import { getActiveAdapter } from './site-adapter';
import { logger } from './logger';

export const DRAWER_WIDTH_PX = 320;
export const DOCK_CLASS = 'qd-docked';

const STYLE_ID = 'question-drawer-dock';

function baseCss(): string {
  return `html.${DOCK_CLASS} { margin-right: ${DRAWER_WIDTH_PX}px !important; }`;
}

function ensureStyle(layoutCss: string): void {
  const existing = document.getElementById(STYLE_ID);
  const css = [baseCss(), layoutCss].filter(Boolean).join('\n');
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}

/**
 * Pushes the host page aside by margin so the docked drawer doesn't cover it.
 * If this fails (host page changed, no <head>, CSP), the panel still works as a
 * fixed overlay — only the layout overlaps.
 */
export function applyDock(
  open: boolean,
  layoutCss: string = getActiveAdapter()?.layoutCss ?? '',
): void {
  try {
    ensureStyle(layoutCss);
    document.documentElement.classList.toggle(DOCK_CLASS, open);
  } catch (error) {
    logger.warn('failed to dock the drawer, falling back to overlay', error);
  }
}

export function cleanupDock(): void {
  document.documentElement.classList.remove(DOCK_CLASS);
  document.getElementById(STYLE_ID)?.remove();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dock.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `SiteAdapter`에 확장 지점 추가**

`src/lib/site-adapter.ts`의 인터페이스에 필드를 추가한다. 두 adapter 구현체는 지금은 값을 주지 않는다 — 현재 두 사이트 모두 우측 가장자리에 뷰포트 고정 요소가 없어 `margin-right`만으로 충분하다. Task 6 수동 QA에서 겹치는 요소가 발견되면 여기에 규칙을 넣는다.

```ts
export interface SiteAdapter {
  id: SiteId;
  getInputBox(): HTMLElement | null;
  insertPrompt(text: string): boolean;
  /**
   * Extra CSS merged into the dock stylesheet, for elements this site pins to
   * the viewport that would sit under the docked drawer. Rules should be
   * scoped to `html.qd-docked`.
   */
  layoutCss?: string;
}
```

- [ ] **Step 6: 언마운트 시 도킹 해제**

`entrypoints/content/index.tsx`에서 import를 추가하고 `onRemove`를 수정한다.

```tsx
import { cleanupDock } from '@/src/lib/dock';
```

```tsx
      onRemove: (root) => {
        root?.unmount();
        cleanupDock();
      },
```

- [ ] **Step 7: 전체 테스트 + 타입 체크**

Run: `npx vitest run && npm run compile`
Expected: 모든 테스트 PASS, 타입 에러 없음

- [ ] **Step 8: Commit**

```bash
git add src/lib/dock.ts src/lib/dock.test.ts src/lib/site-adapter.ts entrypoints/content/index.tsx
git commit -m "feat: push the host page aside when the drawer is docked"
```

---

### Task 3: 색 토큰과 다크 variant

**Files:**
- Modify: `assets/tailwind.css`

**Interfaces:**
- Consumes: 없음
- Produces: Task 4·5에서 쓰는 유틸리티 클래스
  - 배경: `bg-qd-panel`, `bg-qd-card`, `bg-qd-fresh`
  - 보더: `border-qd-line`, `border-qd-accent`
  - 텍스트: `text-qd-ink`, `text-qd-muted`, `text-qd-accent`
  - 다크 대응: `dark:bg-qd-panel-dark`, `dark:bg-qd-card-dark`, `dark:bg-qd-fresh-dark`, `dark:border-qd-line-dark`, `dark:text-qd-ink-dark`, `dark:text-qd-muted-dark`
  - `dark:` variant는 shadow root 최상위 래퍼의 `qd-dark` 클래스로 켜진다 (OS 설정이 아님)

- [ ] **Step 1: `assets/tailwind.css` 작성**

파일 전체를 아래로 교체한다.

```css
@import "tailwindcss";

/* The drawer lives in a shadow root, so Tailwind's default `dark:` variant
   (prefers-color-scheme) would follow the OS instead of the host page. Bind it
   to a class we set from useHostTheme() on the shadow root's top wrapper. */
@custom-variant dark (&:where(.qd-dark, .qd-dark *));

@theme {
  --color-qd-panel: #fdf9ee;
  --color-qd-panel-dark: #1b1a17;
  --color-qd-card: #ffffff;
  --color-qd-card-dark: #26241f;
  --color-qd-fresh: #fef6e0;
  --color-qd-fresh-dark: #33291a;
  --color-qd-line: #f0e3c4;
  --color-qd-line-dark: #3b3529;
  --color-qd-accent: #d97706;
  --color-qd-ink: #2b2620;
  --color-qd-ink-dark: #ede8df;
  --color-qd-muted: #8b8172;
  --color-qd-muted-dark: #9c9384;
}
```

- [ ] **Step 2: 빌드로 검증**

Run: `npm run build`
Expected: 성공. Tailwind가 `@custom-variant`/`@theme`를 파싱하지 못하면 여기서 실패한다.

- [ ] **Step 3: Commit**

```bash
git add assets/tailwind.css
git commit -m "feat: add amber drawer color tokens and host-driven dark variant"
```

---

### Task 4: "방금 담김" 판정 훅

**Files:**
- Create: `src/ui/useFreshItemId.ts`
- Test: `src/ui/useFreshItemId.test.ts`

**Interfaces:**
- Consumes: `DrawerItem` from `@/src/lib/schema`
- Produces:
  - `export const FRESH_MS = 8000`
  - `export function useFreshItemId(newest?: DrawerItem): string | null` — `newest`가 담긴 지 8초 이내면 그 id, 아니면 `null`

- [ ] **Step 1: Write the failing test**

`src/ui/useFreshItemId.test.ts`:

```ts
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
    const { result } = renderHook(() => useFreshItemId(item(Date.now())));
    expect(result.current).toBe('a1');
  });

  it('stops highlighting after the freshness window elapses', () => {
    const { result } = renderHook(() => useFreshItemId(item(Date.now())));
    expect(result.current).toBe('a1');

    act(() => {
      vi.advanceTimersByTime(FRESH_MS + 1);
    });

    expect(result.current).toBeNull();
  });

  it('does not highlight an item stored in a previous session', () => {
    const { result } = renderHook(() => useFreshItemId(item(Date.now() - FRESH_MS - 1)));
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/useFreshItemId.test.ts`
Expected: FAIL — `Failed to resolve import "./useFreshItemId"`

- [ ] **Step 3: Write minimal implementation**

`src/ui/useFreshItemId.ts`:

```ts
import { useEffect, useState } from 'react';
import type { DrawerItem } from '@/src/lib/schema';

export const FRESH_MS = 8000;

/**
 * The id of the newest item while it is still "just added", else null.
 * Derived from createdAt so nothing new has to be persisted.
 */
export function useFreshItemId(newest?: DrawerItem): string | null {
  const [now, setNow] = useState(() => Date.now());

  const id = newest?.id;
  const createdAt = newest?.createdAt;

  useEffect(() => {
    if (createdAt == null) return;
    const remaining = createdAt + FRESH_MS - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [id, createdAt]);

  if (!newest) return null;
  return newest.createdAt + FRESH_MS > now ? newest.id : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/useFreshItemId.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/useFreshItemId.ts src/ui/useFreshItemId.test.ts
git commit -m "feat: track which drawer item was just added"
```

---

### Task 5: 질문 카드 컴포넌트

**Files:**
- Create: `src/ui/DrawerItemCard.tsx`
- Test: `src/ui/DrawerItemCard.test.tsx`

**Interfaces:**
- Consumes: `DrawerItem` from `@/src/lib/schema`; Task 3의 색 유틸리티
- Produces:
  ```ts
  interface Props {
    item: DrawerItem;
    fresh: boolean;
    onClick: () => void;
    onRemove: () => void;
  }
  export function DrawerItemCard(props: Props): JSX.Element
  ```
  카드는 상태를 갖지 않는다. 강조 여부는 `fresh` prop이 결정한다(타이머는 Task 4의 훅이 소유).

- [ ] **Step 1: Write the failing test**

`src/ui/DrawerItemCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawerItemCard } from './DrawerItemCard';
import type { DrawerItem } from '@/src/lib/schema';

const item: DrawerItem = {
  id: 'a1',
  selectedText: 'side effect',
  question: 'side effect에 대해 자세히 설명해줘',
  site: 'claude',
  createdAt: Date.now(),
};

describe('DrawerItemCard', () => {
  it('shows the question and fires onClick', async () => {
    const onClick = vi.fn();
    render(<DrawerItemCard item={item} fresh={false} onClick={onClick} onRemove={() => {}} />);

    await userEvent.click(screen.getByText(item.question));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onRemove from the delete button', async () => {
    const onRemove = vi.fn();
    render(<DrawerItemCard item={item} fresh={false} onClick={() => {}} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the just-added label only when fresh', () => {
    const { rerender } = render(
      <DrawerItemCard item={item} fresh onClick={() => {}} onRemove={() => {}} />,
    );
    expect(screen.getByText('방금 담김')).toBeInTheDocument();

    rerender(
      <DrawerItemCard item={item} fresh={false} onClick={() => {}} onRemove={() => {}} />,
    );
    expect(screen.queryByText('방금 담김')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/DrawerItemCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./DrawerItemCard"`

- [ ] **Step 3: Write minimal implementation**

`src/ui/DrawerItemCard.tsx`:

```tsx
import type { DrawerItem } from '@/src/lib/schema';

interface Props {
  item: DrawerItem;
  fresh: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export function DrawerItemCard({ item, fresh, onClick, onRemove }: Props) {
  return (
    <li
      className={`group relative rounded-xl border transition-colors ${
        fresh
          ? 'border-qd-accent bg-qd-fresh dark:bg-qd-fresh-dark'
          : 'border-qd-line bg-qd-card dark:border-qd-line-dark dark:bg-qd-card-dark'
      }`}
    >
      <button
        onClick={onClick}
        className="flex w-full items-start gap-2 rounded-xl p-3 text-left"
      >
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 text-xs ${
            fresh ? 'text-qd-accent' : 'text-qd-muted dark:text-qd-muted-dark'
          }`}
        >
          {fresh ? '✦' : '?'}
        </span>
        <span className="flex flex-col gap-1">
          <span className="line-clamp-2 text-sm leading-snug text-qd-ink dark:text-qd-ink-dark">
            {item.question}
          </span>
          {fresh && <span className="text-xs text-qd-accent">방금 담김</span>}
        </span>
      </button>
      <button
        aria-label="삭제"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded p-1 text-qd-muted opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 dark:text-qd-muted-dark"
      >
        ×
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/DrawerItemCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/DrawerItemCard.tsx src/ui/DrawerItemCard.test.tsx
git commit -m "feat: add drawer item card component"
```

---

### Task 6: 드로어 패널 재작성

**Files:**
- Modify: `src/ui/DrawerPanel.tsx` (전체 재작성)
- Test: `src/ui/DrawerPanel.test.tsx` (갱신)

**Interfaces:**
- Consumes:
  - `useDrawerItems()` from `./useDrawerItems` → `{ items: DrawerItem[]; remove: (id: string) => void }`
  - `useHostTheme()` from `@/src/lib/theme` → `'light' | 'dark'`
  - `applyDock(open: boolean)` from `@/src/lib/dock`
  - `DRAWER_WIDTH_PX` from `@/src/lib/dock`
  - `useFreshItemId(newest?: DrawerItem)` from `./useFreshItemId`
  - `DrawerItemCard` from `./DrawerItemCard`
- Produces: `export function DrawerPanel({ onItemClick }: { onItemClick: (item: DrawerItem) => void })` — props는 기존과 동일하므로 `App.tsx`는 변경하지 않는다.

- [ ] **Step 1: Write the failing test**

`src/ui/DrawerPanel.test.tsx` 전체를 아래로 교체한다.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing';
import { DrawerPanel } from './DrawerPanel';
import { drawerStorage } from '@/src/lib/storage';
import { createDrawerItem } from '@/src/lib/template';
import { DOCK_CLASS } from '@/src/lib/dock';

describe('DrawerPanel', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.documentElement.classList.remove(DOCK_CLASS);
  });

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

  it('counts the questions in the header', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude'));
    await drawerStorage.add(createDrawerItem('cleanup', 'claude'));
    render(<DrawerPanel onItemClick={() => {}} />);

    expect(await screen.findByText('떠오른 질문 2개 · 클릭하면 바로 질문')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is stored', async () => {
    render(<DrawerPanel onItemClick={() => {}} />);

    expect(
      await screen.findByText('답변에서 궁금한 부분을 드래그해 담아보세요'),
    ).toBeInTheDocument();
  });

  it('lists the newest question first', async () => {
    await drawerStorage.add({ ...createDrawerItem('older', 'claude'), createdAt: 1000 });
    await drawerStorage.add({ ...createDrawerItem('newer', 'claude'), createdAt: 2000 });
    render(<DrawerPanel onItemClick={() => {}} />);

    await screen.findByText('newer에 대해 자세히 설명해줘');
    const questions = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(questions[0]).toContain('newer');
    expect(questions[1]).toContain('older');
  });

  it('docks the page while open and undocks when collapsed', async () => {
    render(<DrawerPanel onItemClick={() => {}} />);

    await waitFor(() =>
      expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(true),
    );

    await userEvent.click(screen.getByRole('button', { name: '서랍 닫기' }));

    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false);
    expect(screen.getByRole('button', { name: '서랍 열기' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/DrawerPanel.test.tsx`
Expected: FAIL — 헤더 개수 문구, 빈 상태, 손잡이 탭 이름을 찾지 못한다

- [ ] **Step 3: Write the implementation**

`src/ui/DrawerPanel.tsx` 전체를 아래로 교체한다.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useDrawerItems } from './useDrawerItems';
import { useFreshItemId } from './useFreshItemId';
import { DrawerItemCard } from './DrawerItemCard';
import { useHostTheme } from '@/src/lib/theme';
import { applyDock, DRAWER_WIDTH_PX } from '@/src/lib/dock';
import type { DrawerItem } from '@/src/lib/schema';

interface Props {
  onItemClick: (item: DrawerItem) => void;
}

export function DrawerPanel({ onItemClick }: Props) {
  const { items, remove } = useDrawerItems();
  const [open, setOpen] = useState(true);
  const theme = useHostTheme();

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items],
  );
  const freshId = useFreshItemId(sorted[0]);

  useEffect(() => {
    applyDock(open);
  }, [open]);

  const subtitle =
    sorted.length > 0
      ? `떠오른 질문 ${sorted.length}개 · 클릭하면 바로 질문`
      : '클릭 한 번으로 질문을 담아두세요';

  return (
    <div className={theme === 'dark' ? 'qd-dark' : undefined}>
      <button
        aria-label={open ? '서랍 닫기' : '서랍 열기'}
        onClick={() => setOpen((v) => !v)}
        style={{ right: open ? DRAWER_WIDTH_PX : 0 }}
        className="fixed top-1/3 z-[2147483647] rounded-l-lg border border-r-0 border-qd-line bg-qd-panel px-2 py-3 text-xs text-qd-muted shadow-sm dark:border-qd-line-dark dark:bg-qd-panel-dark dark:text-qd-muted-dark"
      >
        {open ? '›' : '‹'}
      </button>

      {open && (
        <aside
          style={{ width: DRAWER_WIDTH_PX }}
          className="fixed right-0 top-0 z-[2147483647] flex h-screen flex-col border-l border-qd-line bg-qd-panel font-sans dark:border-qd-line-dark dark:bg-qd-panel-dark"
        >
          <header className="px-4 pb-3 pt-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-qd-ink dark:text-qd-ink-dark">
              <span aria-hidden>🗄️</span>
              질문서랍
            </h2>
            <p className="mt-1 text-xs text-qd-muted dark:text-qd-muted-dark">{subtitle}</p>
          </header>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {sorted.length === 0 ? (
              <p className="rounded-xl border border-dashed border-qd-line px-3 py-6 text-center text-xs leading-relaxed text-balance text-qd-muted dark:border-qd-line-dark dark:text-qd-muted-dark">
                답변에서 궁금한 부분을 드래그해 담아보세요
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sorted.map((item) => (
                  <DrawerItemCard
                    key={item.id}
                    item={item}
                    fresh={item.id === freshId}
                    onClick={() => onItemClick(item)}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-dashed border-qd-line px-4 py-3 text-center text-xs leading-relaxed text-balance text-qd-muted dark:border-qd-line-dark dark:text-qd-muted-dark">
            답변의 단어를 클릭하거나 직접 질문을 적어 담아보세요
          </footer>
        </aside>
      )}
    </div>
  );
}
```

안내 문구는 `<br />`로 쪼개지 않는다. 텍스트 노드가 나뉘면 `getByText('답변에서 궁금한 부분을 드래그해 담아보세요')`가 문자열을 찾지 못한다. 줄바꿈은 `text-balance`와 좁은 패널 너비가 처리한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/DrawerPanel.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 테스트 + 타입 체크**

Run: `npx vitest run && npm run compile`
Expected: 모든 테스트 PASS, 타입 에러 없음

- [ ] **Step 6: Commit**

```bash
git add src/ui/DrawerPanel.tsx src/ui/DrawerPanel.test.tsx
git commit -m "feat: rebuild the drawer as a docked amber sidebar"
```

---

### Task 7: e2e 갱신과 최종 검증

**Files:**
- Modify: `e2e/drawer.spec.ts`

**Interfaces:**
- Consumes: Task 2의 `qd-docked` 클래스, Task 6의 새 마크업
- Produces: 없음 (최종 검증)

- [ ] **Step 1: e2e에 도킹 검증 추가**

`e2e/drawer.spec.ts`의 `captures a selection and inserts the question` 테스트에서, 마지막 삽입 검증 **앞에** 아래를 넣는다. 캡처/삽입 셀렉터는 그대로 통과해야 한다 — 질문 텍스트와 "서랍에 담기" 버튼 이름은 바뀌지 않았다.

```ts
  // The drawer opens docked, so the host page gets pushed aside.
  await expect(page.locator('html')).toHaveClass(/qd-docked/);
```

- [ ] **Step 2: 빌드 후 e2e 실행**

Run: `npm run build && npm run e2e`
Expected: PASS. 실패하면 셀렉터를 새 마크업에 맞춰 고친다 (질문 카드는 여전히 `question-drawer-ui` shadow root 안에 있고 텍스트로 찾을 수 있다).

- [ ] **Step 3: 수동 QA (사람이 확인)**

`.output/chrome-mv3`를 크롬에 로드하고 claude.ai와 chatgpt.com에서 각각 확인한다.

1. 드로어가 우측에 도킹되고 본문이 밀려나는가
2. 본문의 어떤 요소도 패널 아래에 깔리지 않는가 — 깔린다면 해당 사이트 adapter의 `layoutCss`에 `html.qd-docked` 스코프 규칙을 추가한다 (Task 2 Step 5 참고)
3. 손잡이 탭으로 접으면 페이지가 원복되는가
4. 사이트를 다크 모드로 바꾸면 패널도 어두워지는가
5. 텍스트를 담으면 최신 카드가 앰버로 강조됐다가 8초 뒤 일반 카드가 되는가

- [ ] **Step 4: Commit**

```bash
git add e2e/drawer.spec.ts
git commit -m "test: assert the drawer docks the host page in e2e"
```

---

## 참고: 커밋되지 않은 기존 변경

작업 시작 시 `src/ui/DrawerPanel.tsx`에 커밋되지 않은 변경이 있을 수 있다(포매팅 + `z-[2147483647]` → `z-2147483647`). Task 6이 파일을 통째로 교체하므로 그대로 덮어쓰면 된다. 새 코드는 반드시 `z-[2147483647]`을 쓴다.
