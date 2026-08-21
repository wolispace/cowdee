<?php

require_once "utils.php";

header('Access-Control-Allow-Origin: *');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

while (ob_get_level() > 0) ob_end_flush();
flush();

$endTime = time() + 55;
$lastContext = $_GET['last'] ?? $_GET['lastContext'] ?? '0';

while (time() < $endTime) {
  $contexts = get_new_contexts($lastContext);
  if (is_array($contexts) && count($contexts) > 0) {
    foreach ($contexts as $context) {
      sse_event('context', $context);
      $lastContext = "{$context['ts']}{$context['actor']}";
    }
  }
  usleep(250000); // 250ms interval for near-instant SSE delivery
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}
