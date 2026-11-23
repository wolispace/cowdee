<?php
require_once "utils.php";

// When hit as a web request: serve all _db json files as a JSON payload
if (php_sapi_name() !== 'cli') {
    $files = glob(DB_DIR . '/*' . DB_EXT);
    $db = [];
    foreach ($files as $file) {
        $db[basename($file)] = json_decode(file_get_contents($file), true);
    }
    $db['_context.log'] = file_get_contents('_context.log');
    unlink('_context.log');
    header('Content-Type: application/json');
    echo json_encode($db);
    exit;
}

// CLI: fetch from live server and write to local _db/
$url = 'http://wolispace.com/cowdee/backup.php';
$json = file_get_contents($url);
if ($json === false) {
    die("Failed to fetch from $url\n");
}
$db = json_decode($json, true);
if (!is_array($db)) {
    die("Invalid response from server\n");
}

$localDir = '../_backups/' . DB_DIR . '_' . date('YmdHis');
mkdir($localDir);

foreach ($db as $filename => $data) {
    print('.');
    if ($filename === '_context.log') {
        file_put_contents($localDir . '/' . $filename, $data);
    } else {
        file_put_contents($localDir . '/' . $filename, json_encode($data, JSON_PRETTY_PRINT));
    }
}

echo "\nBacked up " . count($db) . " files to {$localDir}/\n";
