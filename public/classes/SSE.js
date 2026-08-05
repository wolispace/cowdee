export class SSE {
  
  constructor() {
    // web server hosted on 8880, SSE server hosted on 8881 since we run php -S for each port
    this.sse = new EventSource('http://localhost:8881/public/server.php');

    this.sse.addEventListener('update', (event) => {
        const msg = JSON.parse(event.data);
        console.log("Game update:", msg);
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