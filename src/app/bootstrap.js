import { createApp } from './createApp.js';

export function bootstrap(root = document.getElementById('app')) {
  if (!root) {
    throw new Error('Cannot start Skyfall Mage2: missing #app root element.');
  }

  const app = createApp({ root });
  app.start();
  window.__SKYFALL_MAGE2_APP__ = app;
  return app;
}
