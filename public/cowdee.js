
import { App } from './classes/App.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App({settings: {nosse: false}});
  // DEBUG expose for debugging
  window.app = app;
  await app.start();
});

