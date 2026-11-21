<?php
require_once "utils.php";

// When hit as a web request: serve all _db json files as a JSON payload
if (php_sapi_name() !== 'cli') {
    $files = glob(DB_DIR . '/*' . DB_EXT);
    $db = [];
    foreach ($files as $file) {
        $db[basename($file)] = json_decode(file_get_contents($file), true);
    }
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

// Delete existing local _db files (except index.html)
foreach (glob(DB_DIR . '/*' . DB_EXT) as $file) {
    unlink($file);
}

// Write fetched files
foreach ($db as $filename => $data) {
    file_put_contents(DB_DIR . '/' . $filename, json_encode($data, JSON_PRETTY_PRINT));
}

echo "Restored " . count($db) . " files to " . DB_DIR . "/\n";
