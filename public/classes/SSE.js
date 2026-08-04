export class SSE {
  
  constructor() {
    this.sse = new EventSource('server.php');

    this.sse.addEventListener('update', (e) => {
        const msg = JSON.parse(e.data);
        console.log("Game update:", msg);
    });

    this.sse.addEventListener('ping', () => {
        // console.log("heartbeat");
    });

    this.sse.addEventListener('shutdown', () => {
       // console.log("Server ended session, reconnecting soon...");
    });

    this.sse.onerror = () => {
       // console.log("Connection lost, retrying...");
    };
  }
}