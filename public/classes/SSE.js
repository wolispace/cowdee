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
    const sseroot = this.app.webroot.replace('8880', '8881');
    const url = new URL(sseroot + 'sse.php');
    url.searchParams.set('last', this.app.lastContext);
    console.log('[SSE] connecting ', url.toString());

    if (typeof EventSource !== 'undefined') {
      this.sse = new EventSource(url.toString());

      this.sse.addEventListener('context', async (event) => {
        const rawContext = JSON.parse(event.data);
        console.log('[SSE] received:', rawContext, 'lastContext:', this.app.lastContext);
        const context = new Context(this.app, rawContext);
        await context.process();
      });

      this.sse.addEventListener('shutdown', async () => {
        console.log('[SSE] shutdown, reconnecting...');
        if (!this.aborted) {
          this.close();
          await this.connect();
        }
      });
      this.sse.onerror = async (e) => {
        console.log('[SSE] error, state:', this.sse?.readyState, e);
        if (!this.aborted) {
          this.close();
          setTimeout(() => this.connect(), 1000);
        }
      };
    } else {
      // Node.js environment fallback using standard fetch stream
      this.connectNode(url.toString());
    }
  }

  async connectNode(urlString) {
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

      while (!this.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); // remaining incomplete line

        let currentEvent = 'message';
        let currentData = '';

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
        console.log('[SSE] shutdown, reconnecting...');
        setTimeout(() => {
          if (!this.aborted) this.connect();
        }, 250);
      }
    } catch (err) {
      if (this.aborted || err.name === 'AbortError') return;
      console.log('[SSE] error, state:', err.message);
      setTimeout(() => {
        if (!this.aborted) this.connect();
      }, 1000);
    }
  }

  async handleMessage(event, dataStr) {
    try {
      const rawContext = JSON.parse(dataStr);
      if (event === 'context') {
        console.log('[SSE] received:', rawContext, 'lastContext:', this.app.lastContext);
        const context = new Context(this.app, rawContext);
        await context.process();
      } else if (event === 'shutdown') {
        console.log('[SSE] shutdown, reconnecting...');
        this.close();
        if (!this.aborted) {
          await this.connect();
        }
      }
    } catch (e) {
      // ignore parse errors for ping or non-json data
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