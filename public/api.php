<?php

$body = json_decode(file_get_contents('php://input'), true);
$cmd = $body['cmd'] ?? $_POST['cmd'] ?? null;

if ($cmd) {
  file_put_contents('commands.txt', $cmd . PHP_EOL, FILE_APPEND);
  outputJson(['status' => 'ok']);
}

function outputJson($data) {
  header('Content-Type: application/json');
  $data['x'] = "1";
  echo json_encode($data);
}

function loadJson($file) {
  return json_decode(file_get_contents($file), true);
}

function saveJson($data, $file) {
  logIt('save ' . $file . ' ' . json_encode($data));
  file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}
