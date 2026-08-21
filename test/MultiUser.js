import { App } from '../public/cowdee.js';
import { Tester } from './Tester.js';

/**
 * Shared Context Hub simulating the SSE server broadcast
 * Dispatches contexts across real App instances
 */
class ContextHub {
  constructor() {
    this.apps = [];
    this.history = [];
    this.globalCounter = 1;
  }

  register(app) {
    this.apps.push(app);
    // Intercept sendCommand to broadcast through the hub
    const originalSendCommand = app.sendCommand.bind(app);
    app.sendCommand = async (data) => {
      const rawContext = {
        ts: Date.now(),
        actor: app.player.info.id,
        loc: app.player.info.loc,
        cmd: typeof data === 'string' ? data : data.cmd,
        counter: app.id.counter
      };
      await this.broadcast(rawContext);
    };
  }

  async broadcast(rawContext) {
    if (!rawContext.ts) rawContext.ts = Date.now();
    if (!rawContext.counter) rawContext.counter = this.globalCounter;
    if (rawContext.counter > this.globalCounter) {
      this.globalCounter = rawContext.counter;
    }

    this.history.push(rawContext);

    // Replicate context to all connected clients
    for (const app of this.apps) {
      await app.processContexts([rawContext]);
    }
  }
}

async function runMultiUserSimulation() {
  console.log('=====================================================');
  console.log('       COWDEE MULTI-USER REAL-APP TEST               ');
  console.log('=====================================================\n');

  // 1. Initialize DB fixtures
  const initApp = new App({ debug: true, headless: true, settings: { generate: true, max: 5 } });
  initApp.tester = new Tester(initApp);
  initApp.tester.deleteTestFiles();
  await initApp.tester.initObjects();
  await initApp.tester.initPlayers();
  await initApp.tester.initCommands();
  await initApp.db.savePoolsToDisk();
  console.log('✔ Initialized test database fixtures.\n');

  // 2. Create the Hub and 3 independent real App instances
  const hub = new ContextHub();
  const wolis = new App({ debug: true, headless: true });
  const bob = new App({ debug: true, headless: true });
  const jane = new App({ debug: true, headless: true });

  hub.register(wolis);
  hub.register(bob);
  hub.register(jane);

  // 3. Test Storage isolation in unlogged '0' void state
  console.log('-----------------------------------------------------');
  console.log('TEST 1: Storage namespace in unlogged "0" void state');
  console.log('-----------------------------------------------------');
  console.log('   Initial Wolis storage namespace:', wolis.storage.getNamespace());
  console.log('   Initial Bob storage namespace:  ', bob.storage.getNamespace());
  if (wolis.storage.getNamespace() !== '0' || bob.storage.getNamespace() !== '0') {
    throw new Error('FAILED: Initial storage namespace must be "0"');
  }

  // 4. Log in players and verify namespace transition
  console.log('\n-----------------------------------------------------');
  console.log('TEST 2: Login and Player namespace transition');
  console.log('-----------------------------------------------------');
  await wolis.player.handleLogon({ playername: 'Wolis' });
  await bob.player.handleLogon({ playername: 'Bob' });
  await jane.player.handleLogon({ playername: 'Jane' });

  console.log(`   Wolis logged in: ID="${wolis.player.info.id}", Loc="${wolis.player.info.loc}", Namespace="${wolis.storage.getNamespace()}"`);
  console.log(`   Bob logged in:   ID="${bob.player.info.id}", Loc="${bob.player.info.loc}", Namespace="${bob.storage.getNamespace()}"`);
  console.log(`   Jane logged in:  ID="${jane.player.info.id}", Loc="${jane.player.info.loc}", Namespace="${jane.storage.getNamespace()}"`);

  if (wolis.storage.getNamespace() !== 'wol' || bob.storage.getNamespace() !== 'bob' || jane.storage.getNamespace() !== 'jan') {
    throw new Error('FAILED: Storage namespace did not update to player ID on login!');
  }

  // Verify storage isolation (each player has their own playerInfo key in storage)
  const wolisStoredInfo = JSON.parse(wolis.storage.getItem('playerInfo'));
  const bobStoredInfo = JSON.parse(bob.storage.getItem('playerInfo'));
  console.log('   Wolis stored info in storage:', wolisStoredInfo);
  console.log('   Bob stored info in storage:  ', bobStoredInfo);
  if (wolisStoredInfo.id !== 'wol' || bobStoredInfo.id !== 'bob') {
    throw new Error('FAILED: Storage keys collided between players!');
  }

  // 5. Test Object creation & replication across clients
  console.log('\n-----------------------------------------------------');
  console.log('TEST 3: Bob creates a white cup in Room 2');
  console.log('-----------------------------------------------------');
  await bob.sendCommand({ cmd: 'create a white cup' });

  console.log('   Bob UI last message:  ', bob.ui.messages[bob.ui.messages.length - 1]);
  console.log('   Wolis UI last message:', wolis.ui.messages[wolis.ui.messages.length - 1]);

  const cupInWolisDB = await wolis.db.findByNameInLoc('cup', '2');
  const cupInBobDB = await bob.db.findByNameInLoc('cup', '2');
  console.log(`   Cup in Bob's local DB:   ${cupInBobDB ? 'YES (ID: ' + cupInBobDB + ')' : 'NO'}`);
  console.log(`   Cup in Wolis's local DB: ${cupInWolisDB ? 'YES (ID: ' + cupInWolisDB + ')' : 'NO'}`);

  if (!cupInBobDB || !cupInWolisDB) {
    throw new Error('FAILED: Created cup was not replicated to local DBs!');
  }

  // 6. Test Chat & Spatial Filtering
  console.log('\n-----------------------------------------------------');
  console.log('TEST 4: Spatial Chat & Message Filtering');
  console.log('-----------------------------------------------------');
  const janeMsgCountBefore = jane.ui.messages.length;

  await bob.sendCommand({ cmd: 'say hello Wolis in the house' });

  console.log('   Wolis heard:', wolis.ui.messages[wolis.ui.messages.length - 1]);
  const janeMsgCountAfter = jane.ui.messages.length;
  console.log(`   Jane (in Library loc 3) received new messages: ${janeMsgCountAfter - janeMsgCountBefore} (Expected: 0)`);

  if (janeMsgCountAfter !== janeMsgCountBefore) {
    throw new Error('FAILED: Jane received message from another room!');
  }

  console.log('\n=====================================================');
  console.log('           ALL MULTI-USER TESTS PASSED!              ');
  console.log('=====================================================\n');
  process.exit(0);
}

runMultiUserSimulation().catch(err => {
  console.error('Error during simulation:', err);
  process.exit(1);
});
