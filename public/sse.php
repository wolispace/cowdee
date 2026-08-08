<?php

require_once "utils.php";

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
        
        $since = $data['ts'];
      }
    }
  }
}

//$contexts = check_files($dir, $since);

while (time() < $endTime) {
  $contexts = check_files($dir, $since);
  foreach ($contexts as $context) {
    sse_event('context', $context);
  }
  usleep(500000);
}

sse_event('shutdown', ['reason' => 'session ended, client should reconnect']);

function sse_event($event, $data) {
  echo "event: $event\n";
  echo "data: " . json_encode($data) . "\n\n";
  flush();
}
