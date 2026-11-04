
import { App } from './classes/App.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App({settings: {nosse: false}});
  await app.start();
});

