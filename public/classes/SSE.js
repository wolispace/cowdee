import { Context } from './Context.js';

export class SSE {

  constructor(app) {
    this.app = app;
    this.sse = null;
    this.aborted = false;
    this.abortController = null;
  }

  async connect() {
    this.aborted = false;
    const sseroot = this.app.webroot.replace('8880', '8881').replace(/\/?$/, '/');
    const url = new URL(sseroot + 'sse.php');
    url.searchParams.set('last', this.app.lastContext);
    

    if (typeof EventSource !== 'undefined') {
      this.connectWeb(url.toString());
    } else {
      // Node.js environment fallback using standard fetch stream
      this.connectNode(url.toString());
    }
  }

  async connectWeb(urlString) {
    console.log('[SSEweb] connecting ',this.app.name, urlString);
    this.sse = new EventSource(urlString);

    this.sse.addEventListener('context', async (event) => {
      const rawContext = JSON.parse(event.data);
      console.log('[SSEweb] received:', this.app.name, rawContext, 'lastContext:', this.app.lastContext);
      const context = new Context(this.app, rawContext);
      await context.process();
    });

    this.sse.addEventListener('shutdown', async () => {
      console.log('[SSEweb] shutdown, reconnecting...', this.app.name);
      if (!this.aborted) {
        this.close();
        await this.connect();
      }
    });
    this.sse.onerror = async (e) => {
      console.log('[SSEweb] error, state:', this.app.name, this.sse?.readyState, e);
      if (!this.aborted) {
        this.close();
        setTimeout(() => this.connect(), 1000);
      }
    };

  }
  async connectNode(urlString) {
    console.log('[SSEnode] connecting ',this.app.name, urlString);
    try {
      this.abortController = new AbortController();
      const response = await fetch(urlString, {
        headers: { 'Accept': 'text/event-stream' },
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';
      let currentData = '';

      while (!this.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); // remaining incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            // End of an SSE message block
            if (currentData) {
              await this.handleMessage(currentEvent, currentData);
              currentEvent = 'message';
              currentData = '';
            }
            continue;
          }
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            currentData += (currentData ? '\n' : '') + trimmed.slice(5).trim();
          }
        }
      }

      if (!this.aborted) {
        console.log('[SSEnode] shutdown, reconnecting...', this.app.name);
        setTimeout(() => {
          if (!this.aborted) this.connect();
        }, 250);
      }
    } catch (err) {
      if (this.aborted || err.name === 'AbortError') return;
      console.log('[SSEnode] error, state:', this.app.name, err.message);
      setTimeout(() => {
        if (!this.aborted) this.connect();
      }, 1000);
    }
  }

  async handleMessage(event, dataStr) {
    console.log('[SSE] handleMessage event:', this.app.name, event, 'data:', dataStr.slice(0, 60));
    try {
      const rawContext = JSON.parse(dataStr);
      if (event === 'context') {
        console.log('[SSE] received:', this.app.name, rawContext, 'lastContext:', this.app.lastContext);
        const context = new Context(this.app, rawContext);
        await context.process();
      } else if (event === 'shutdown') {
        console.log('[SSE] shutdown, reconnecting...', this.app.name);
        this.close();
        if (!this.aborted) {
          await this.connect();
        }
      }
    } catch (e) {
      console.log('[SSE] parse error:', this.app.name, e.message);
    }
  }

  close() {
    this.aborted = true;
    if (this.sse) {
      if (typeof this.sse.close === 'function') this.sse.close();
      this.sse = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

}