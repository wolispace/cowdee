<?php

require_once "utils.php";

header('Access-Control-Allow-Origin: *');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

while (ob_get_level() > 0) ob_end_flush();
flush();

$endTime = time() + 55;
$last = isset($_GET['last']) ? (int)$_GET['last'] : 0;



while (time() < $endTime) {
  $contexts = get_new_contexts($last);
  if (is_array($contexts)) {
    foreach ($contexts as $context) {
      sse_event('context', $context);
    }
  }
  usleep(500000);
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}
