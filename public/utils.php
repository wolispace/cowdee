<?php
// require_once "utils.php";
 
define('CONTEXT_DIR', '../_contexts'); // root level folder for context files
define('ID_COUNTER_FILE', '../_db/_counter.txt'); // the counter of the last highest ID
function logIt($str) {
  $dateTime = date('Ymd H:i:s');
  file_put_contents('_log.txt', "{$dateTime},{$_SERVER['REMOTE_ADDR']},{$str}\n", FILE_APPEND | LOCK_EX);
}

function get_new_contexts($last) {
    $files = glob(CONTEXT_DIR . '/*.json');
    if (!$files) return [];
    sort($files);
    // If last == '0', return ONLY the newest context
    if ($last === '0') {
      $file = end($files);
      return [ json_decode(file_get_contents($file), true) ];
    }
    // Otherwise return all contexts newer than $last
    $contexts = [];
    foreach ($files as $file) {
      $ts = (int) substr(basename($file), 0, 13);
      if ($ts < (time() - 3600) * 1000) { unlink($file); continue; }
      $data = json_decode(file_get_contents($file), true);
      $lastCounter = file_get_contents(ID_COUNTER_FILE);
      if ($data['counter'] < $lastCounter) {
        $data['counter'] = $lastCounter;
      }
      $key = "{$data['ts']}{$data['actor']}";

      if ($key > $last) {
        $contexts[] = $data;
      }
    }
    return $contexts;
}

