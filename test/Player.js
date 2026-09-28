import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

console.log('=====================================================');
console.log('              PLAYER & AUTO-LOGIN TEST               ');
console.log('=====================================================\n');

const app = new App({ settings: { name: 'testApp', generate: true, max: 3 } });
app.tester = new Tester(app);
await app.tester.deleteTestFiles();
await app.tester.initObjects(3);
await app.tester.initPlayers();
await app.db.saveToDisk();

// Test 1: Direct properties on Player
console.log('TEST 1: Direct properties & info backward-compatibility');
app.player.id = 'wol';
app.player.loc = '_2';
if (app.player.id !== 'wol' || app.player.info.id !== 'wol') {
  throw new Error('FAILED: app.player.id or app.player.info.id failed');
}
if (app.player.loc !== '_2' || app.player.info.loc !== '_2') {
  throw new Error('FAILED: app.player.loc or app.player.info.loc failed');
}
console.log('✔ Direct properties and compatibility getter pass');

// Test 2: Login with "Remember me" checked
console.log('\nTEST 2: Login with "Remember me"');
await app.player.handleLogon({ playername: 'Wolis', remember: '1' });
if (app.player.id !== '_wol') {
  throw new Error(`FAILED: Expected player ID _wol, got ${app.player.id}`);
}
if (app.storage.getItem('rememberedPlayer') !== '_wol') {
  throw new Error('FAILED: rememberedPlayer was not set in storage');
}
console.log('✔ Logged in as Wolis and rememberedPlayer stored');

// Test 3: Command history addition and persistence
console.log('\nTEST 3: Command history addition & save');
app.player.addHistory('look');
app.player.addHistory('examine basket');
app.player.addHistory('look'); // deduplication test

if (app.player.history.length !== 2) {
  throw new Error(`FAILED: Expected history length 2, got ${app.player.history.length}`);
}
if (app.player.history[1] !== 'look') {
  throw new Error(`FAILED: Expected 'look' to be moved to the end of history`);
}
const savedRecord = JSON.parse(app.storage.getItem('player__wol'));
if (!savedRecord || savedRecord.history.length !== 2) {
  throw new Error('FAILED: player record in storage did not contain updated history');
}
console.log('✔ Command history saved and deduplicated correctly');

// Test 4: Reloading / Simulating fresh app start with Remember Me
console.log('\nTEST 4: Auto-login on new app start');
const newApp = new App({ settings: { name: 'newApp' } });
await newApp.player.load();

if (newApp.player.id !== '_wol') {
  throw new Error(`FAILED: Auto-login failed, expected _wol, got ${newApp.player.id}`);
}
if (newApp.player.history.length !== 2 || newApp.player.history[1] !== 'look') {
  throw new Error('FAILED: History was not restored on auto-login');
}
console.log('✔ Auto-login succeeded with restored history:', newApp.player.history);

// Test 5: Logoff
console.log('\nTEST 5: Logoff clears remembered player');
newApp.player.clear();
if (newApp.storage.getItem('rememberedPlayer')) {
  throw new Error('FAILED: rememberedPlayer still exists after clear()');
}
if (newApp.player.id !== '') {
  throw new Error('FAILED: player.id not empty after clear()');
}
console.log('✔ Logoff successfully cleared remembered player');

// Test 6: Reloading after logoff shows welcome instead of auto-login
console.log('\nTEST 6: Fresh start after logoff does not auto-login');
let welcomeCalled = false;
const loggedOffApp = new App({ settings: { name: 'loggedOffApp' } });
loggedOffApp.player.welcome = async () => { welcomeCalled = true; };
await loggedOffApp.player.load();
if (loggedOffApp.player.id !== '') {
  throw new Error('FAILED: Player should not be logged in');
}
if (!welcomeCalled) {
  throw new Error('FAILED: welcome() should have been called');
}
console.log('✔ Fresh start prompted welcome() instead of auto-login');

console.log('\n=====================================================');
console.log('           ALL PLAYER TESTS PASSED!                  ');
console.log('=====================================================\n');
process.exit(0);
