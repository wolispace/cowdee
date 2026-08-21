<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require_once "utils.php";

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

// always recieve json data
$request = json_decode(file_get_contents('php://input'), true);

handleInput($request);

function handleInput($request) {
  if (!$request) return;

  if (!empty($request['cmd'])) {
    $mstimestamp = round(microtime(true) * 1000);
    $lastContext = $request['lastContext'] ?? '0';

    if (is_string($lastContext) && strlen($lastContext) >= 13) {
      $lastTs = (int) substr($lastContext, 0, 13);
      if ($mstimestamp <= $lastTs) {
        $mstimestamp = $lastTs + 1;
      }
    }

    $filename = CONTEXT_DIR . "/{$mstimestamp}{$request['actor']}.json";
    $contextData = [
      'ts' => $mstimestamp,
      'counter' => $request['counter'], 
      'actor' => $request['actor'], 
      'loc' => $request['loc'], 
      'cmd' => $request['cmd']
    ];
    file_put_contents($filename, json_encode($contextData));

    // get all new contexts we have not seen yet
    $contexts = get_new_contexts($lastContext);
    if (empty($contexts)) {
      $contexts = [$contextData];
    }
    outputJson(['contexts' => json_encode($contexts)]);

  } else if (!empty($request['file'])) {
    $file = shardName($request['file']);
    if (empty($request['content'])) {
      outputJson(loadJson($file));
    } else {
      $oldCounter = file_get_contents(ID_COUNTER_FILE);
      if ($request['counter'] > $oldCounter) {
        file_put_contents(ID_COUNTER_FILE, $request['counter']);
      }
      saveJson($file, json_decode($request['content'], true));
      outputJson(['ok' => true]);
    }
    } else if (!empty($request['lastContext'])) {
      outputJson(['lastContext' => get_last_context()]);
    }
}

/**
 * Builts a data file name based on the type and key eg index_name_8.json
 * @param {string} type
 * @param {string} key
 */
function shardName($filename) {
  return "../_db/{$filename}.json";
}

function outputJson($data) {
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function loadJson($file) {
  if (!file_exists($file)) return null;
  return json_decode(file_get_contents($file), true);
}

function saveJson($file, $data) {
  logIt('save ' . $file . ' ' . json_encode($data));
  file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}
