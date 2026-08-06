<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

while (ob_get_level() > 0) ob_end_flush();
flush();

$dir = '_contexts';
$endTime = time() + 55;
$since = isset($_GET['since']) ? (int)$_GET['since'] : 0;

function check_files($dir, &$since) {
  $files = glob("$dir/*.json");
  if ($files) {
    sort($files);
    foreach ($files as $file) {
      $data = json_decode(file_get_contents($file), true);
      if ($data['ts'] > $since) {
        sse_event('context', $data);
        $since = $data['ts'];
      }
    }
  }
}

check_files($dir, $since);

while (time() < $endTime) {
  check_files($dir, $since);
  usleep(500000);
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}
