import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '../.output/chrome-mv3');

// Kept in sync with DRAWER_WIDTH_PX in src/lib/dock.ts; e2e runs against the
// built extension, so it can't import from src.
const DRAWER_WIDTH_PX = 320;

// Fixture mimics chatgpt.com's input box so the adapter resolves without login.
// A live-site flow requires a logged-in session and is documented as manual.
//
// This test loads the built extension (.output/chrome-mv3) into a real
// Chromium instance and drives the full capture -> persist -> insert flow
// against the local fixture page above. It requires a headful (or
// `--headless=new`) Chromium launch to load the unpacked extension.
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

// The extension only matches claude.ai / chatgpt.com; route a fake chatgpt page.
async function mountFixture(page: Page) {
  await page.route('*://chatgpt.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><head><style>
        /* Mirrors chatgpt.com's real app shell, which carries Tailwind's
           w-screen (width: 100vw). Viewport units ignore a margin on <html>,
           so a plain-flow fixture would dock fine and hide the bug. */
        body { margin: 0 }
        .w-screen { width: 100vw }
      </style></head><body>
        <div id="shell" class="flex h-svh w-screen flex-col">
          <p id="answer">side effect</p>
          <div id="prompt-textarea" contenteditable="true"></div>
        </div>
      </body></html>`,
    }),
  );
}

test('captures a selection and inserts the question', async () => {
  const page = await context.newPage();
  await mountFixture(page);
  await page.goto('https://chatgpt.com/');

  await page.getByText('side effect').selectText();
  await page.dispatchEvent('body', 'mouseup');

  // The button lives in the extension's shadow root.
  const host = page.locator('question-drawer-ui');
  await host.getByRole('button', { name: '서랍에 담기' }).click();

  const item = host.getByText('side effect에 대해 자세히 설명해줘');
  await expect(item).toBeVisible();

  await item.click();

  // The drawer opens docked, so the host page gets pushed aside.
  // `:root` (not `html`) because `html` also matches the synthetic
  // <html> WXT injects inside the shadow root for style isolation.
  await expect(page.locator(':root')).toHaveClass(/qd-docked/);

  // Marking <html> is not enough: assert the shell actually got narrower.
  // Without this the drawer just covers the page and the test still passes.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.innerWidth -
          document.getElementById('shell')!.getBoundingClientRect().width,
      ),
    )
    .toBe(DRAWER_WIDTH_PX);

  await expect(page.locator('#prompt-textarea')).toContainText('side effect에 대해 자세히 설명해줘');
});

test('keeps questions scoped to the conversation they were captured in', async () => {
  const page = await context.newPage();
  await mountFixture(page);

  // Capture inside conversation A.
  await page.goto('https://chatgpt.com/c/conversation-a');
  await page.getByText('side effect').selectText();
  await page.dispatchEvent('body', 'mouseup');

  const host = page.locator('question-drawer-ui');
  await host.getByRole('button', { name: '서랍에 담기' }).click();
  await expect(host.getByText('side effect에 대해 자세히 설명해줘')).toBeVisible();

  // Conversation B never saw that question.
  await page.goto('https://chatgpt.com/c/conversation-b');
  await expect(
    page.locator('question-drawer-ui').getByText('답변에서 궁금한 부분을 드래그해 담아보세요'),
  ).toBeVisible();
  await expect(
    page.locator('question-drawer-ui').getByText('side effect에 대해 자세히 설명해줘'),
  ).toHaveCount(0);

  // Back in A, it is still there.
  await page.goto('https://chatgpt.com/c/conversation-a');
  await expect(
    page.locator('question-drawer-ui').getByText('side effect에 대해 자세히 설명해줘'),
  ).toBeVisible();
});
