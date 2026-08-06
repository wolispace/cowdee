<?php

// always recieve json data
$request = json_decode(file_get_contents('php://input'), true);

handleInput($request);

function handleInput($request) {

  if (!empty($request['cmd'])) {
    /*
    We are writing a context per line in our text file
    who what where and then (sorted as when,who,where,what)
    {timestamp},{actor},{loc},{cmd}
    The timestamp will be microseconds
    Combination of msTimestamp + actor] is the unique key per command.
    */
    $mstimestamp = round(microtime(true) * 1000);
    $filename = "_contexts/{$mstimestamp}_{$request['actor']}.json";
    $context = json_encode(['ts' => $mstimestamp, 'actor' => $request['actor'], 'loc' => $request['loc'], 'cmd' => $request['cmd']]);
    file_put_contents($filename, $context);
    outputJson(['status' => "ok"]);
  } else if (!empty($request['file'])) {
    $file = shardName($request['type'], $request['key']);
    if (empty($request['content'])) {
      $json = loadJson($request['file']);
      outputJson($json);
    } else {
      // write json to disk..
      saveJson($request['file'], $request['content']);
    }
    return outputJson(['error' => 'invalid request']);
  }
}

/**
 * Builts a data file name based on the type and key eg index_name_8.json
 * @param {string} type
 * @param {string} key
 */
function shardName($type = '_', $key = '_') {
  return "_data/index_{$type}_{$key[0]}.json";
}

function outputJson($data) {
  header('Content-Type: application/json');
  $data['x'] = "1";
  echo json_encode($data);
  exit;
}

function loadJson($file) {
  return json_decode(file_get_contents($file), true);
}

function saveJson($file, $data) {
  logIt('save ' . $file . ' ' . json_encode($data));
  file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}
