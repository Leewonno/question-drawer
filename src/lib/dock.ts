import { logger } from "./logger";

export const DRAWER_WIDTH_PX = 320;
export const DOCK_CLASS = "qd-docked";

const STYLE_ID = "question-drawer-dock";

// The margin alone docks claude.ai, whose shell sits in normal flow. It cannot
// dock chatgpt.com: that shell is Tailwind's `w-screen` (width: 100vw), and
// viewport units resolve against the viewport, not the margin-shrunk <html>
// box — so the shell keeps its full width and the panel just covers it. CSS
// can't redefine `vw`, so the only fix is to override the width itself.
// Everything below the shell is `w-full`/`flex-1` and follows it.
// The transition lives on the base (undocked) selector so the margin/width
// animate in both directions — toggling the class only swaps the target value,
// it doesn't re-declare the transition. Duration matches the panel's slide in
// DrawerPanel.tsx (300ms) so the page and the drawer move as one.
const CSS = [
  `html { transition: margin-right 300ms ease; }`,
  `html.${DOCK_CLASS} { margin-right: ${DRAWER_WIDTH_PX}px !important; }`,
  `html [class~="w-screen"] { transition: width 300ms ease; }`,
  `html.${DOCK_CLASS} [class~="w-screen"] { width: calc(100vw - ${DRAWER_WIDTH_PX}px) !important; }`,
].join("\n");

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

/**
 * Pushes the host page aside by margin so the docked drawer doesn't cover it.
 * If this fails (host page changed, no <head>, CSP), the panel still works as a
 * fixed overlay — only the layout overlaps.
 */
export function applyDock(open: boolean): void {
  try {
    ensureStyle();
    document.documentElement.classList.toggle(DOCK_CLASS, open);
  } catch (error) {
    logger.warn("failed to dock the drawer, falling back to overlay", error);
  }
}

export function cleanupDock(): void {
  document.documentElement.classList.remove(DOCK_CLASS);
  document.getElementById(STYLE_ID)?.remove();
}
