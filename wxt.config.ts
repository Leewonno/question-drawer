import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Question Drawer",
    description: "AI 답변에서 궁금한 내용을 드래그해 질문으로 저장",
    permissions: ["storage", "clipboardWrite"],
    host_permissions: [
      "*://claude.ai/*",
      "*://chatgpt.com/*",
      "*://*.kimi.com/*",
      "*://gemini.google.com/*",
      "*://*.deepseek.com/*",
      "*://grok.com/*",
    ],
    // Pretendard is loaded at runtime via a chrome-extension:// URL so it
    // bypasses the host pages' strict `default-src 'none'` CSP. The font must be
    // web-accessible for the content script to fetch it.
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: [
          "*://claude.ai/*",
          "*://chatgpt.com/*",
          "*://*.kimi.com/*",
          "*://gemini.google.com/*",
          "*://*.deepseek.com/*",
          "*://grok.com/*",
        ],
      },
    ],
  },
});
