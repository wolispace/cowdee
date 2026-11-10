// Preload script for Node to expose LZString globally (matching index.php browser environment)
const LZString = require('../public/lz-string.min.js');
globalThis.LZString = LZString;

