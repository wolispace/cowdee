<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

while (ob_get_level() > 0) ob_end_flush();
flush();

$dir = '_contexts';
$endTime = time() + 25;
$lastSeen = '';

while (time() < $endTime) {
  $files = glob("$dir/*.json");
  if ($files) {
    sort($files);
    foreach ($files as $file) {
      if ($file > $lastSeen) {
        sse_event('context', json_decode(file_get_contents($file), true));
        $lastSeen = $file;
      }
    }
  }
  sse_event('ping', ['alive' => true]);
  sleep(3);
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}
