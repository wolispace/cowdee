<?php
// require_once "utils.php";
 
define('CONTEXT_DIR', '../_contexts'); // root level folder for context files

function get_new_contexts($last) {
  $contexts = [];
  
  $files = glob(CONTEXT_DIR. '/*.json');
  if ($files) {
    sort($files);
    foreach ($files as $file) {
      $data = json_decode(file_get_contents($file), true);
      $key = "{$data['ts']}{$data['actor']}";
      if ($key > $last) {
        $last = $key;
        $contexts[] = $data;
      }
    }
  }
  return $contexts;
}
