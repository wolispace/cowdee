<?php
// require_once "utils.php";
define('APP_NAME', 'cowdee'); // name for cow
define('APP_TITLE', 'Dirstibuted COW'); // name for cow
define('APP_VERSION', '0.10.4'); // the version

define('CONTEXT_DIR', '_contexts'); // folder for context files relative to public
define('CONTEXT_EXT', '.json'); // file type for json
define('CONTEXT_MINS', 5); // how long to keep context messages hangin around (this really could be quite low as we are not interested in old msgs. 5 mins might be too long even)
define('DB_DIR', '_db'); // folder for db json files relative to public
define('DB_EXT', '.json'); // extension of db files
define('LOCK_FILE', '_lockfile.txt'); // if present we have the db locked for writting
define('PLAYER_DIR', '_players'); //where active players are recorded eg _2.txt _wol.txt etc..
define('ACTIVE_PLAYER_SECS', 20); // if last activity from a player is > this then we consider them logged off/asleep
define('ID_COUNTER_FILE', '_counter.txt'); // the counter of the last highest ID

function logIt($str) {
  $dateTime = date('Ymd H:i:s');
  file_put_contents('_log.txt', "{$dateTime},{$_SERVER['REMOTE_ADDR']},{$str}\n", FILE_APPEND | LOCK_EX);
}

/**
 * Returns an array of context messages > the last context passed in.
 * Old context files are deleted after 15 mins
 * @param string $lastContext
 * @return array
 */
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
  
    if ($ts < (time() - (60 * CONTEXT_MINS)) * 1000) { 
      @unlink($file);
      logIt('kill old file ' . $file . ', ' . $ts . ' < ' . (time() - 3600) * 1000); 
      continue; 
    }
    $data = json_decode(file_get_contents($file), true);
    $lastCounter = @file_get_contents(DB_DIR . '/' . ID_COUNTER_FILE);
    if (empty($data['counter']) || $data['counter'] < $lastCounter) {
      $data['counter'] = $lastCounter;
    }
    $key = "{$data['ts']}{$data['actor']}";

    if ($key > $lastContext) {
      $contexts[] = $data;
    }
  }
  $json = [
    'contexts' => $contexts,
    'players' => getActivePlayers()
  ];

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

/**
 * Records a player as being active - creates a file with the pid and the current timestamp
 * @param string $pid
 * @return void
 */
function refreshPlayer($pid) {
  if (empty($pid)) return;
  file_put_contents(PLAYER_DIR . "/{$pid}.txt", time());
}

/**
 * Returns an array of string of the current active player ids eg ['_2','_h3'] 
 * Active = have done something in the last 21 seconds - sending a tick is the heatbeat
 * @return array
 */
function getActivePlayers() {
  $files = glob(PLAYER_DIR . '/*.txt');
  if (!$files) return [];
  $players = [];
  foreach ($files as $file) {
    $players[] = basename($file, '.txt');
    // if file is ? 20 seconds old, delete it as they are nolonger active
    if (time() - filemtime($file) > ACTIVE_PLAYER_SECS) {
      unlink($file);
      logIt("kill player file {$file}");
    }
  }
  return $players;
}


/**
 * Calculates total size of files in a directory.
 * @param string $dir
 * @param bool $recursive
 * @return int
 */
function getDirFilesSize($dir, $recursive = false)
{
  $size = 0;
  if (!is_dir($dir)) {
    return 0;
  }
  $entries = scandir($dir);
  if ($entries === false) {
    return 0;
  }
  foreach ($entries as $entry) {
    if ($entry === '.' || $entry === '..') {
      continue;
    }
    $path = $dir . DIRECTORY_SEPARATOR . $entry;
    if (is_file($path)) {
      $size += filesize($path);
    } else if ($recursive && is_dir($path)) {
      $size += getDirFilesSize($path, true);
    }
  }
  return $size;
}
