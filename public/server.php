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
    outputJson(['contexts' => $contexts]);
  } else if (!empty($request['lock'])) {
    // send the player ID as the lock value, we set into the lock file ?lock=wol
    // if the option is to clear then we must match the lock file contents ?lock=wol&clear=1
    $lockfile = DB_DIR . '/' . LOCK_FILE;
    if (!empty($request['clear'])) {
      $contents = file_get_contents($lockfile);
      if ($contents == $request['lock']) {
        outputJson(['status' => unlink($lockfile)]);
        return;
      }
    } else {
      if (file_exists($lockfile)) {
        // remove stale lock files > 10mins old
        $age = time() - filemtime($lockfile);
        if ($age > (10 * 60)) {
          unlink($lockfile);
        }
        outputJson(['status' => false]);
        return;
      }
      outputJson(['status' => file_put_contents($lockfile, $request['lock']) > 0]);
    }
    return ``;
  } else if (!empty($request['batch'])) {
    $counterFile = DB_DIR . '/' . ID_COUNTER_FILE;
    if (file_exists($counterFile)) {
      $oldCounter = (int) file_get_contents($counterFile);
      if (isset($request['counter']) && $request['counter'] > $oldCounter) {
        logIt("Incremented counter from {$oldCounter} to {$request['counter']}");
        file_put_contents($counterFile, $request['counter']);
      }
    } else if (isset($request['counter'])) {
      file_put_contents($counterFile, $request['counter']);
    }

    foreach ($request['batch'] as $filename => $data) {
      $file = shardName($filename);
      saveJson($file, $data);
    }
    outputJson(['ok' => true]);
  } else if (!empty($request['file'])) {
    $file = shardName($request['file']);
    if (empty($request['content'])) {
      outputJson(loadJson($file));
    } else {
      $counterFile = DB_DIR . '/' . ID_COUNTER_FILE;
      $oldCounter = file_get_contents($counterFile);
      if ($request['counter'] > $oldCounter) {
        logIt("Incremented counter from {$oldCounter} to {$request['counter']}");
        file_put_contents($counterFile, $request['counter']);
      }
      saveJson($file, json_decode($request['content'], true));
      outputJson(['ok' => true]);
    }
  } else if (!empty($request['lastContext'])) {
    outputJson(['lastContext' => get_last_context()]);
  } else {
    outputJson(['ok' => false]);
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
