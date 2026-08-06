<?php
// --- SSE headers ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

// Disable buffering
while (ob_get_level() > 0) {
  ob_end_flush();
}
flush();

// How long this SSE session should run
$sessionDuration = 25; // stay under shared-host 30s limit
$endTime = time() + $sessionDuration;
$file = '_contexts.txt';
$lastFile = '_last_context_size.txt';
$lastSize = file_get_contents($lastFile) ?? 0;

// Main loop
while (time() < $endTime) {
  clearstatcache(true, $file);
  $currentSize = file_exists($file) ? filesize($file) : 0;
  
  if ($currentSize > $lastSize) {
    $f = fopen($file, 'r');
    if (flock($f, LOCK_SH)) {
      fseek($f, $lastSize);
      $newContent = fread($f, $currentSize - $lastSize);
      flock($f, LOCK_UN);
      fclose($f);
      $lines = explode("\n", trim($newContent));
      foreach ($lines as $line) {
        if ($line !== '') sse_event("context", $line);
      }
      $lastSize = $currentSize;
      file_put_contents($lastFile, $lastSize);    
    }
  }
  //-- Heartbeat every 5 seconds ---
  sse_event("ping", ["alive" => true]);
  // Sleep before next cycle
  sleep(3);
}

// Helper to send SSE events
function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}

// Graceful shutdown message
sse_event("shutdown", [
    "reason" => "session ended, client should reconnect"
]);

