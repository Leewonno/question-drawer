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
//
// gemini.google.com has the same problem for a different reason: its Angular
// shell is the `<bard-sidenav-container>` custom element, sized to the viewport
// (100vw) and so ignoring the <html> margin — the panel just covers it. Shrink
// that element instead; its sidenav + content (flex/100%) reflow to follow.
// A lone `width` override isn't enough here: Gemini also pins the shell with
// `min-width: 100vw`, which would clamp the width straight back to full. Pin
// all three (width/min-width/max-width) so none of them can win it back.
//
// Gemini's top bar (`<top-bar-actions>`: the 업그레이드/더보기 buttons) is a
// SIBLING of that shell, anchored to the viewport's right edge — so shrinking
// the shell leaves it sitting under the drawer. It isn't width-driven, so slide
// the whole bar left by the drawer width with a transform instead.
//
// deepseek.com is another 100vw-shell case: a single flex row (sidebar + main)
// that ignores the <html> margin. DeepSeek exposes no stable class on that
// shell — only hashed ones — so target it two ways and let whichever matches
// win: (1) a stable, DeepSeek-scoped structural anchor — #root's child that
// contains the composer <textarea name="search"> (present even on an empty
// chat); (2) the current hashed shell class as a fallback for builds where the
// root id or nesting differs. The header lives inside `main`, so it reflows with
// the shell — no separate sibling shift is needed as on Gemini.
//
// The transition lives on the base (undocked) selector so the margin/width
// animate in both directions — toggling the class only swaps the target value,
// it doesn't re-declare the transition. Duration matches the panel's slide in
// DrawerPanel.tsx (300ms) so the page and the drawer move as one.
const DOCKED_WIDTH = `calc(100vw - ${DRAWER_WIDTH_PX}px)`;
// NOTE: verify on the live page — if docking stops working after a DeepSeek
// redeploy, the hashed fallback class (.c3ecdb44) is the first thing to refresh.
const DEEPSEEK_SHELLS = [
  '#root > div:has(textarea[name="search"])',
  ".c3ecdb44",
];
const deepseekBase = DEEPSEEK_SHELLS.map((s) => `html ${s}`).join(", ");
const deepseekDocked = DEEPSEEK_SHELLS.map(
  (s) => `html.${DOCK_CLASS} ${s}`,
).join(", ");
const CSS = [
  `html { transition: margin-right 300ms ease; }`,
  `html.${DOCK_CLASS} { margin-right: ${DRAWER_WIDTH_PX}px !important; }`,
  `html [class~="w-screen"] { transition: width 300ms ease; }`,
  `html.${DOCK_CLASS} [class~="w-screen"] { width: ${DOCKED_WIDTH} !important; }`,
  `html bard-sidenav-container { transition: width 300ms ease, min-width 300ms ease, max-width 300ms ease; }`,
  `html.${DOCK_CLASS} bard-sidenav-container {` +
    ` width: ${DOCKED_WIDTH} !important;` +
    ` min-width: ${DOCKED_WIDTH} !important;` +
    ` max-width: ${DOCKED_WIDTH} !important; }`,
  `html top-bar-actions { transition: transform 300ms ease; }`,
  `html.${DOCK_CLASS} top-bar-actions { transform: translateX(-${DRAWER_WIDTH_PX}px) !important; }`,
  `${deepseekBase} { transition: width 300ms ease, min-width 300ms ease, max-width 300ms ease; }`,
  `${deepseekDocked} {` +
    ` width: ${DOCKED_WIDTH} !important;` +
    ` min-width: ${DOCKED_WIDTH} !important;` +
    ` max-width: ${DOCKED_WIDTH} !important; }`,
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
