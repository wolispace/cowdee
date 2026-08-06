export class SSE {
  
  constructor() {
    // web server hosted on 8880, SSE server hosted on 8881 since we run php -S for each port
    const url = new URL(window.location.href);
    // Override only the port and pathname
    url.port = '8881';
    url.pathname = '/public/sse.php';

    // for dev this will be 'http://localhost:8881/public/sse.php'
    this.sse = new EventSource(url.toString());
    

    // TODO: convert string into a context object
    // - do we need a Context() class?
    // remember last context key (timestamp+actorID) so we dont show the same one twice
    // process each context as it comes in as per this.app.commandManager.handle() 
    const lastSeen = () => localStorage.getItem('lastContext') || '';

    this.sse.addEventListener('context', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ts <= lastSeen()) return;
        localStorage.setItem('lastContext', msg.ts);
        console.log("process context:", msg);
    });

    this.sse.addEventListener('ping', () => {
        //console.log("heartbeat");
    });

    this.sse.addEventListener('shutdown', () => {
       // console.log("Server ended session, reconnecting soon...");
    });

    this.sse.onerror = () => {
       // console.log("Connection lost, retrying...");
    };
  }
}