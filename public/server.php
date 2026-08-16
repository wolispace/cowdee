<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require_once "utils.php";

// always recieve json data
$request = json_decode(file_get_contents('php://input'), true);

handleInput($request);

function handleInput($request) {

  if (!empty($request['cmd'])) {
    /*
    We are writing a context to disk.
    who what where and then (sorted as when,who,where,what)
    {timestamp},{actor},{loc},{cmd}
    The timestamp will be microseconds
    Combination of msTimestamp + actor is the unique filename  
      1786021222321_wol.json
      {"ts":1786021222321,"actor":"wol","loc":"2","cmd":"create a white cup"}
    */
    $mstimestamp = round(microtime(true) * 1000);
    $filename = CONTEXT_DIR . "/{$mstimestamp}{$request['actor']}.json";
    $context = json_encode([
      'ts' => $mstimestamp,
      'counter' => $request['counter'], 
      'actor' => $request['actor'], 
      'loc' => $request['loc'], 
      'cmd' => $request['cmd']]);
    file_put_contents($filename, $context);
    // get all new contexts we have not seen yet
    $last = $request['last'] ?? '0';
    $contexts = get_new_contexts($last);
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
