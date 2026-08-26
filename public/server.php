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

    $contextData = [
      'ts' => $mstimestamp,
      'counter' => $request['counter'], 
      'actor' => $request['actor'], 
      'loc' => $request['loc'], 
      'cmd' => $request['cmd']
    ];

    if (!is_dir(CONTEXT_DIR)) {
        // Create the directory
        mkdir(CONTEXT_DIR, 0755, true);
        logIt("Folder created successfully!");
    } else {
        logIt("Folder already exists.");
    }

    $filename = CONTEXT_DIR . "/{$mstimestamp}{$request['actor']}" . CONTEXT_EXT ;
    file_put_contents($filename, json_encode($contextData));
    logIt("saved context file $filename");

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
      $counterFile = DB_DIR . '/' . ID_COUNTER_FILE;
      $oldCounter = file_get_contents($counterFile);
      if ($request['counter'] > $oldCounter) {
        file_put_contents($counterFile, $request['counter']);
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
  return DB_DIR . "/{$filename}" . DB_EXT;
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
