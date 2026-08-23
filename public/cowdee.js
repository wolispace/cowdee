
import { App } from './classes/App.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App({settings: {nosse: true}});
  await app.start();
});

