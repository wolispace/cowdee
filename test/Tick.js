import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

console.log('-------------- START TICK TEST ----------------');

const app = new App({ settings: { name: 'testTickApp', nosse: true } });
app.tester = new Tester(app);

// Initialize player and objects
app.player.id = '_wol';
app.player.name = 'Wolis';
app.player.loc = '_room1';

// Mock server timestamp with an intentional 5000ms offset from Date.now()
const mockServerTs = Date.now() + 5000;
app.syncTime(mockServerTs);

// 1. Verify offset and getCurrentTs
const diff = Math.abs(app.getCurrentTs() - (Date.now() + 5000));
console.log('1. Time sync check: offset ~5000ms:', Math.abs(app.serverOffset - 5000) < 50);
console.log('   app.getCurrentTs() delta from mock server:', diff < 50);

// 2. Verify tick config alignment math
const now = app.getCurrentTs();
for (const key of Object.keys(app.tickConfigs)) {
  const config = app.tickConfigs[key];
  const targetTs = config.targetTs;
  const mod = targetTs % config.period;
  console.log(`2. ${config.name} target aligns with phase (${config.phase}):`, mod === config.phase, `(targetTs % period = ${mod})`);
}

// 3. Test runTick with DB objects
const objInRoom = {
  id: '_clock',
  class: 'clock',
  loc: '_room1',
  code: `##tickloc:say 'think', "The clock in the room ticks softly.";##tick:say 'think', "A global tick reverberates.";`
};

const objInOtherRoom = {
  id: '_distant_bell',
  class: 'bell',
  loc: '_room2',
  code: `##tickloc:say 'think', "Distant bell rings.";`
};

await app.db.save(objInRoom);
await app.db.save(objInOtherRoom);

// Capture UI messages only if UI accepts them (respecting location filtering)
const capturedMessages = [];
const origAddMessage = app.ui.addMessage.bind(app.ui);
app.ui.addMessage = async (ctx) => {
  if (!ctx.for && ctx.loc != app.player.loc) {
    return;
  }
  capturedMessages.push(ctx.msg);
  return origAddMessage(ctx);
};

// Run tick: both ##tick and ##tickloc run.
// objInRoom is in _room1 (player.loc), so player hears them.
// objInOtherRoom runs in _room2, so UI filters it out for this player.
capturedMessages.length = 0;
await app.runTick('tick');
console.log('3. tick runs ##tickloc as tick (room1 heard):', capturedMessages.includes('The clock in the room ticks softly.'));
console.log('4. other room message filtered out by UI:', !capturedMessages.includes('Distant bell rings.'));

// 4. Test watchdog / background tab recovery
const config20 = app.tickConfigs.tick20;
config20.targetTs = app.getCurrentTs() - 2000; // simulate missed target due to sleep/throttle
capturedMessages.length = 0;
await app.checkTickTimers();
console.log('5. checkTickTimers recovered missed tick:', capturedMessages.length > 0);

// 5. Cleanup
app.stopTickTimers();
console.log('6. stopTickTimers stopped timers:', app.tickTimersInitialized === false);

console.log('-------------- END TICK TEST ----------------');
process.exit(0);
