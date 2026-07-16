import { browser } from 'wxt/browser';
import { logger } from './logger';

const FONT_FAMILY = 'Pretendard Variable';
const FONT_ASSET = 'fonts/PretendardVariable.woff2';

/**
 * Register Pretendard as a document font at runtime.
 *
 * The extension renders into a shadow root on claude.ai / chatgpt.com, whose
 * CSP is `default-src 'none'` with no font-src — so CDN and data:-URI fonts are
 * blocked. Only the extension's own web-accessible resource is exempt, and its
 * absolute chrome-extension:// URL is not knowable until runtime, so it can't
 * live in a static @font-face. Fonts added to `document.fonts` are visible to
 * shadow DOM, so one load covers the whole UI.
 */
export async function loadPretendard(): Promise<void> {
  // Guard against double-registration across content-script re-invocations.
  if ([...document.fonts].some((face) => face.family === FONT_FAMILY)) return;

  try {
    const url = browser.runtime.getURL(FONT_ASSET as never);
    const face = new FontFace(FONT_FAMILY, `url(${url}) format('woff2-variations')`, {
      weight: '45 920',
      style: 'normal',
      display: 'swap',
    });
    await face.load();
    document.fonts.add(face);
  } catch (error) {
    logger.warn('failed to load Pretendard font, falling back to system fonts', error);
  }
}
