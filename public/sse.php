<?php
set_time_limit(0);
require_once "utils.php";

header('Access-Control-Allow-Origin: *');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-WWebserver-Streaming: 1');

while (ob_get_level() > 0) ob_end_flush();
ob_implicit_flush(true);
flush();

$endTime = time() + 55;
$lastContext = $_GET['last'] ?? $_GET['lastContext'] ?? '0';

// Send an initial keepalive to flush the TCP buffer (PHP built-in server buffers until enough data)
echo ": keepalive\n\n";
echo ": " . str_repeat(' ', 4096) . "\n\n"; // 4KB padding to overflow PHP built-in server buffer
flush();

while (time() < $endTime) {
  $contexts = get_new_contexts($lastContext);
  if (is_array($contexts) && count($contexts) > 0) {
    foreach ($contexts as $context) {
      sse_event('context', $context);
      $lastContext = "{$context['ts']}{$context['actor']}";
    }
  }
  if ( connection_aborted() ) break;

  usleep(250000); // 250ms interval for near-instant SSE delivery
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}


/*
  const eventSource = nw EventSource('sse.php');
  eventSource.AddEventListener('context', (event) => {
    console.log(event, data);
    
  })

*/