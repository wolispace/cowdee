<?php
// --- SSE headers ---
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('Access-Control-Allow-Origin: *');

// Disable buffering
while (ob_get_level() > 0) {
    ob_end_flush();
}
flush();

// How long this SSE session should run
$sessionDuration = 25; // stay under shared-host 30s limit
$endTime = time() + $sessionDuration;

// Helper to send SSE events
function sse_event($event, $data) {
    echo "event: $event\n";
    echo "data: " . json_encode($data) . "\n\n";
    flush();
}

// Main loop
while (time() < $endTime) {

    // --- Read game state from disk ---
    $state = ["state" => "ok"];
    
    // --- Send updates to the client ---
    sse_event("update", [
        "timestamp" => time(),
        "state"     => $state
    ]);

    // --- Heartbeat every 5 seconds ---
    sse_event("ping", ["alive" => true]);

    // Sleep before next cycle
    sleep(5);
}

// Graceful shutdown message
sse_event("shutdown", [
    "reason" => "session ended, client should reconnect"
]);

