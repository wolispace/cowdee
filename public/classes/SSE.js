import { Context } from './Context.js';

export class SSE {

  constructor(app) {
    this.app = app;
    // web server hosted on 8880, SSE server hosted on 8881 since we run php -S for each port
    const url = new URL(window.location.href);
    // Override only the port and pathname
    url.port = '8881';
    url.pathname = '/public/sse.php';
  }

  async connect() {
    const url = new URL(window.location.href);
    url.port = '8881';
    url.pathname = '/public/sse.php';
    url.searchParams.set('last', this.app.lastContext);
    console.log('[SSE] connecting, last:', this.app.lastContext || '(none)');
    this.sse = new EventSource(url.toString());

    this.sse.addEventListener('context', async (event) => {
      const rawContext = JSON.parse(event.data);
      console.log('[SSE] received:', rawContext, 'lastContext:', this.app.lastContext);
      const context = new Context(this.app, rawContext);
      await context.process();
    });

    this.sse.addEventListener('shutdown', async () => {
      console.log('[SSE] shutdown, reconnecting...');
      await this.connect();
    });
    this.sse.onerror = async (e) => {
      console.log('[SSE] error, state:', this.sse.readyState, e);
      setTimeout(await this.connect(), 1000);
    };
  };

}