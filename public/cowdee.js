
import { App } from './classes/App.js';

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.start();
  });
}

