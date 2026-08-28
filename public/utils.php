<?php
// require_once "utils.php";
 



define('CONTEXT_DIR', '_contexts'); // folder for context files relative to public
define('CONTEXT_EXT', '.json'); // file type for json
define('DB_DIR', '_db'); // folder for db json files relative to public
define('DB_EXT', '.json'); // extension of db files
define('LOCK_FILE', '_lockfile.txt'); // if present we have the db locked for writting

define('ID_COUNTER_FILE', '_counter.txt'); // the counter of the last highest ID
function logIt($str) {
  $dateTime = date('Ymd H:i:s');
  file_put_contents('_log.txt', "{$dateTime},{$_SERVER['REMOTE_ADDR']},{$str}\n", FILE_APPEND | LOCK_EX);
  }
  
  function get_new_contexts($lastContext) {
  $files = glob(CONTEXT_DIR . '/*' . CONTEXT_EXT);
  if (!$files) return [];
  sort($files);
  // If last == '0', return ONLY the newest context
  if ($lastContext == '0') {
    $file = end($files);
    return [ json_decode(file_get_contents($file), true) ];
  }
  // Otherwise return all contexts newer than $lastContext
  $contexts = [];
  foreach ($files as $file) {
    $ts = substr(basename($file), 0, 13);
    if ($ts < (time() - 3600) * 1000) { 
      unlink($file);
      logIt('kill old file ' . $file . ', ' . $ts . ' < ' . (time() - 3600) * 1000); 
      continue; 
    }
    $data = json_decode(file_get_contents($file), true);
    $lastCounter = file_get_contents(DB_DIR . '/' . ID_COUNTER_FILE);
    if ($data['counter'] < $lastCounter) {
      $data['counter'] = $lastCounter;
    }
    $key = "{$data['ts']}{$data['actor']}";

    if ($key > $lastContext) {
      logIt("get_new_contexts key={$key}, lastContext={$lastContext}");
      $contexts[] = $data;
    }
  }
  return $contexts;
}

function get_last_context() {
    $files = glob(CONTEXT_DIR . '/*' . CONTEXT_EXT);
    if (!$files) return null;

    rsort($files); // newest filename first
    $file = $files[0];

    $lastfile = pathinfo($file, PATHINFO_FILENAME);
    if (empty($lastfile)) {
      $lastfile = round(microtime(true) * 1000);
    }
    return $lastfile;
}

