function connect() {
    const sse = new EventSource('server.php');

    sse.addEventListener('update', (e) => {
        const msg = JSON.parse(e.data);
        console.log("Game update:", msg);
    });

    sse.addEventListener('ping', () => {
        console.log("heartbeat");
    });

    sse.addEventListener('shutdown', () => {
        console.log("Server ended session, reconnecting soon...");
    });

    sse.onerror = () => {
        console.log("Connection lost, retrying...");
    };
}

connect();
