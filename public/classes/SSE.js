export class SSE {
  
  constructor() {
    // web server hosted on 8880, SSE server hosted on 8881 since we run php -S for each port
    const url = new URL(window.location.href);
    // Override only the port and pathname
    url.port = '8881';
    url.pathname = '/public/sse.php';

    const lastContext = () => localStorage.getItem('lastContext') || '';

    const connect = () => {
      const url = new URL(window.location.href);
      url.port = '8881';
      url.pathname = '/public/sse.php';
      url.searchParams.set('since', lastContext());
      console.log('[SSE] connecting, since:', lastContext() || '(none)');
      this.sse = new EventSource(url.toString());

      this.sse.addEventListener('context', (event) => {
        const msg = JSON.parse(event.data);
        //console.log('[SSE] received:', msg.ts, 'lastContext:', lastContext);
        // if (msg.ts <= lastTs) return;
        // localStorage.setItem('lastContext', msg.ts);
        // console.log('[SSE] processing:', msg);
      });

      this.sse.addEventListener('shutdown', () => {
        console.log('[SSE] shutdown, reconnecting...');
        connect();
      });
      this.sse.onerror = (e) => {
        console.log('[SSE] error, state:', this.sse.readyState, e);
        setTimeout(connect, 1000);
      };
    };

    connect();
  }
}