export class SSE {
  
  constructor() {
    // web server hosted on 8880, SSE server hosted on 8881 since we run php -S for each port
    const url = new URL(window.location.href);
    // Override only the port and pathname
    url.port = '8881';
    url.pathname = '/public/server.php';

    // for dev this will be 'http://localhost:8881/public/server.php'
    this.sse = new EventSource(url.toString());
    
    this.sse.addEventListener('context', (event) => {
        const msg = JSON.parse(event.data);
        console.log("new context:", msg);
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