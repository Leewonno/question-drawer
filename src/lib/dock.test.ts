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

  it('shrinks viewport-width shells, which the margin alone cannot push', () => {
    applyDock(true);

    // jsdom has no layout engine, so this pins the rule's presence only; the
    // e2e test is what measures that the shell really gets narrower.
    expect(document.getElementById(STYLE_ID)?.textContent).toContain(
      `width: calc(100vw - ${DRAWER_WIDTH_PX}px)`,
    );
  });

  it("shrinks gemini's viewport-filling Angular shell", () => {
    applyDock(true);

    // jsdom has no layout engine, so this pins the rule's presence only; the
    // e2e test is what measures that the shell really gets narrower. Gemini
    // clamps the shell with min-width: 100vw, so the override must pin
    // min-width too or the width alone gets clamped straight back.
    const css = document.getElementById(STYLE_ID)?.textContent ?? '';
    expect(css).toContain(`width: calc(100vw - ${DRAWER_WIDTH_PX}px) !important`);
    expect(css).toContain(
      `min-width: calc(100vw - ${DRAWER_WIDTH_PX}px) !important`,
    );
  });

  it("shrinks deepseek's viewport-width flex shell via a stable anchor and a fallback", () => {
    applyDock(true);

    // jsdom has no layout engine, so this pins the rule's presence only; the
    // e2e test is what measures that the shell really gets narrower. DeepSeek
    // has no stable class on the shell, so we target it both by a scoped
    // structural anchor (the composer <textarea name="search">) and by the
    // current hashed class as a fallback; min-width is pinned in case DeepSeek
    // also clamps with min-width: 100vw like gemini.
    const css = document.getElementById(STYLE_ID)?.textContent ?? '';
    expect(css).toContain('textarea[name="search"]');
    expect(css).toContain('.c3ecdb44');
    expect(css).toContain(
      `min-width: calc(100vw - ${DRAWER_WIDTH_PX}px) !important`,
    );
  });

  it("slides gemini's viewport-anchored top bar out from under the drawer", () => {
    applyDock(true);

    // The 업그레이드/더보기 buttons sit in <top-bar-actions>, a sibling of the
    // shrunk shell, so they need their own leftward shift.
    expect(document.getElementById(STYLE_ID)?.textContent).toContain(
      `top-bar-actions { transform: translateX(-${DRAWER_WIDTH_PX}px) !important`,
    );
  });

  it('unmarks html when closed but leaves the stylesheet in place', () => {
    applyDock(true);
    applyDock(false);

    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false);
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
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
