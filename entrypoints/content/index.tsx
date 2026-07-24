import './style.css';
import ReactDOM from 'react-dom/client';
import { App } from '@/src/ui/App';
import { getActiveAdapter } from '@/src/lib/site-adapter';
import { logger } from '@/src/lib/logger';
import { cleanupDock } from '@/src/lib/dock';
import { loadPretendard } from '@/src/lib/font';

export default defineContentScript({
  matches: ['*://claude.ai/*', '*://chatgpt.com/*', '*://*.kimi.com/*', '*://gemini.google.com/*', '*://*.deepseek.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const adapter = getActiveAdapter();
    if (!adapter) {
      logger.warn('no adapter for host, skipping mount');
      return;
    }
    void loadPretendard();
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
      onRemove: (root) => {
        root?.unmount();
        cleanupDock();
      },
    });
    ui.mount();
  },
});
