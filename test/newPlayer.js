/**
 * test/newPlayer.js
 *
 * Simulates the full new-player login flow that a browser would perform,
 * but running in Node so there is no dialog / DOM involved.
 *
 * Architecture note:
 *   The server saves context files and normally browsers receive them via SSE.
 *   In Node we call app.start() which starts SSE, then after sendWakeCmd()
 *   we give SSE a moment to deliver the context back so Context.process()
 *   can call player.newPlayer() and player.wakePlayer() as it would in
 *   a real browser session.
 *
 * The webserver must be running on http://localhost for this test to pass.
 *
 * Run with:  node --localstorage-file=_storage/local.sqlite test/newPlayer.js
 */

import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

console.log('=====================================================');
console.log('         NEW PLAYER LOGIN SIMULATION TEST           ');
console.log('=====================================================\n');

// ── helpers ─────────────────────────────────────────────────────────────────

function assert(condition, msg) {
  if (!condition) throw new Error(`FAILED: ${msg}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP: fresh DB with known players
// ─────────────────────────────────────────────────────────────────────────────
const app = new App({ settings: { name: 'newPlayerTest', generate: true, max: 3 } });
app.tester = new Tester(app);

console.log('Setting up fresh test DB...');
await app.tester.deleteTestFiles();
await app.tester.initObjects(3);
await app.tester.initPlayers();       // Wolis/_wol, Bob/_bob, Jane/_jan
await app.tester.initCommands();
await app.db.saveToDisk();
console.log('✔ Test DB ready\n');

// Start the app so SSE runs and can deliver contexts back to this Node process
await app.start();
await sleep(200); // let SSE connect

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — brand-new player that does NOT exist in the DB
//
// Browser flow this replicates:
//   1. Type name → handleFindPlayer → not found → show newPlayerContent dialog
//   2. User enters password → handleNewPlayer → sendWakeCmd
//   3. sendWakeCmd sends: { cmd:'wake', actor:'player-NewGuy-_2', loc:'_2' }
//   4. Server saves context file; SSE delivers it back
//   5. Context.process() sees actor is not an id → calls player.newPlayer(actor)
//   6. newPlayer() creates the object, sets player.id/loc, calls wakePlayer()
//   7. wakePlayer() sends 'look' and the player is live
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 1: Brand-new player login flow');

let wakePlayerCalled = false;
let wakePlayerId     = null;
const origWakePlayer = app.player.wakePlayer.bind(app.player);
app.player.wakePlayer = async function () {
  wakePlayerCalled = true;
  wakePlayerId     = this.id;
  console.log(`  [spy] wakePlayer called: id=${this.id} loc=${this.loc}`);
  // Call through so the 'look' fires (optional but realistic)
  // Don't await — keep the test moving
};

const newName = 'NewGuy';

// Step 1: find player — not in DB
await app.player.handleFindPlayer({ playername: newName, remember: '1' });
assert(app.player.name === newName,
  `player.name should be "${newName}", got "${app.player.name}"`);
assert(app.player.id === '',
  `player.id should still be empty before wake, got "${app.player.id}"`);
console.log(`  ✔ handleFindPlayer: name="${app.player.name}", no id yet (new player)`);

// Step 2: simulate user submitting the password form
await app.player.handleNewPlayer({ pw: 'mysecret', remember: '1' });

// Wait for SSE to deliver the wake context and for Context.process() to run
await sleep(1500);

assert(wakePlayerCalled,
  'wakePlayer() should have been called after handleNewPlayer (context processed via SSE)');
assert(app.player.id !== '',
  `player.id should be set after wake, got "${app.player.id}"`);
assert(app.player.loc !== '',
  `player.loc should be set after wake, got "${app.player.loc}"`);
console.log(`  ✔ handleNewPlayer complete: id="${app.player.id}" loc="${app.player.loc}"`);

// Verify the player object was saved into the DB
const savedPlayer = await app.db.getById(app.player.id);
assert(savedPlayer,
  `Player object ${app.player.id} should exist in DB after wake`);
assert(savedPlayer.class === 'player',
  `saved object class should be 'player', got "${savedPlayer.class}"`);
assert(savedPlayer.name === newName,
  `saved object name should be "${newName}", got "${savedPlayer.name}"`);
// pw is stored in a separate shard; getById() intentionally strips it out
const savedPw = await app.db.getPw(app.player.id);
assert(savedPw,
  'saved player pw shard should contain a hashed password');
console.log(`  ✔ DB entry verified: id="${savedPlayer.id}" name="${savedPlayer.name}" loc="${savedPlayer.loc}" pw=SET(${savedPw?.length})`)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — existing player login (regression: should still work)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 2: Existing player (Wolis) login — regression check');

let wake2Called = false;
const app2 = new App({ settings: { name: 'existingTest', nosse: true } });
app2.player.wakePlayer = async function () {
  wake2Called = true;
  console.log(`  [spy] wakePlayer called: id=${this.id}`);
};

// In Node, app.window is false so logon() is called directly (no pw dialog needed)
await app2.player.handleFindPlayer({ playername: 'Wolis' });
await sleep(500);

assert(app2.player.id === '_wol',
  `Expected _wol, got "${app2.player.id}"`);
// Note: with nosse, wakePlayer is reached only if sendCommand returns contexts.
// In the batched-cmd path it won't — so just check the player id was set by logon()
console.log(`  ✔ Existing player logon() set id="${app2.player.id}"`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — sendWakeCmd no longer silently bails for new players
//           (verifies the fix: the commented-out `return` is removed)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 3: sendWakeCmd no longer silently returns for new players');

const app3 = new App({ settings: { name: 'guardTest', nosse: true } });
let cmdSentActor = null;
// Intercept sendCommand before it hits the server
app3.sendCommand = async (params) => { cmdSentActor = params.actor; };
app3.io.fetchJson = async () => ({ lastContext: '999' });
app3.ui.closeDialog  = () => {};
app3.ui.showLoading  = () => {};

app3.player.name = 'TestPerson';
app3.player.id   = '';   // no id = new player scenario
await app3.player.sendWakeCmd();

assert(cmdSentActor !== null,
  'sendCommand should be called for new player (no silent bail)');
assert(cmdSentActor === 'player-TestPerson-_2',
  `actor should be 'player-TestPerson-_2', got "${cmdSentActor}"`);
console.log(`  ✔ sendWakeCmd sent actor="${cmdSentActor}" (no silent bail)`);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=====================================================');
console.log('        ALL NEW PLAYER TESTS PASSED!               ');
console.log('=====================================================\n');
process.exit(0);
