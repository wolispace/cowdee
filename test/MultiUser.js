import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMultiUserSimulation() {
  console.log('=====================================================');
  console.log('       COWDEE MULTI-USER REAL-APP TEST               ');
  console.log('=====================================================\n');

  // 1. Initialize DB fixtures
  const initApp = new App({ settings: { name: 'initApp', generate: true, max: 3 } });
  initApp.tester = new Tester(initApp);
  await initApp.tester.deleteTestFiles();
  await initApp.tester.initObjects(initApp.settings.max);
  await initApp.tester.initPlayers();
  await initApp.tester.initCommands();
  await initApp.db.saveToDisk();
  await initApp.utils.sleep(300);
  console.log(`✔ Initialized test database fixtures. DB Counter: ${initApp.id.counter}\n`);

  // 2. Create 3 independent real App instances and connect to SSE / Server
  const wolis = new App({ settings: { name: '_wol' } });
  const bob = new App({ settings: { name: '_bob' } });
  const jane = new App({ settings: { name: '_jan' } });

  await wolis.start();
  await bob.start();
  await jane.start();

  // Allow initial SSE handshake
  await initApp.utils.sleep(300);

  try {
    // 3. Log in players and verify player info & storage records
    console.log('-----------------------------------------------------');
    console.log('TEST 1: Player login and storage records');
    console.log('-----------------------------------------------------');
    await wolis.player.handleLogon({ playername: 'Wolis' });
    await bob.player.handleLogon({ playername: 'Bob' });
    await jane.player.handleLogon({ playername: 'Jane' });

    console.log(`   Wolis logged in: ID="${wolis.player.id}", Loc="${wolis.player.loc}"`);
    console.log(`   Bob logged in:   ID="${bob.player.id}", Loc="${bob.player.loc}"`);
    console.log(`   Jane logged in:  ID="${jane.player.id}", Loc="${jane.player.loc}"`);

    // Verify storage records for each player
    const wolisStoredInfo = JSON.parse(wolis.storage.getItem('player__wol'));
    const bobStoredInfo = JSON.parse(bob.storage.getItem('player__bob'));
    console.log('   Wolis stored info in storage:', wolisStoredInfo);
    console.log('   Bob stored info in storage:  ', bobStoredInfo);
    if (wolisStoredInfo.id !== '_wol' || bobStoredInfo.id !== '_bob') {
      throw new Error('FAILED: Stored player records invalid!');
    }

    // 5. Test Object creation & replication across clients over SSE
    const newObjName = 'pig';
    console.log('\n-----------------------------------------------------');
    console.log(`TEST 3: Bob creates a pink ${newObjName} in Room _2`);
    console.log('-----------------------------------------------------');
    await bob.sendCommand({ cmd: `create a pink ${newObjName}` });

    // Wait for SSE broadcast across network/server
    await initApp.utils.sleep(2000);
    console.log('bob name _P', bob.db.memory.name._P);
    console.log('wolis name _P', wolis.db.memory.name._P);
    console.log('jane name _P', jane.db.memory.name._P);


    const newObjInBobDB = await bob.db.findByNameInLoc(newObjName, '_2');
    const newObjInWolisDB = await wolis.db.findByNameInLoc(newObjName, '_2');
    const decodedBobId = newObjInBobDB ? bob.id.decodeInt(newObjInBobDB) : -1;
    const decodedWolisId = newObjInWolisDB ? wolis.id.decodeInt(newObjInWolisDB) : -1;

    console.log(`   newObj in Bob's local DB:   ${newObjInBobDB ? 'YES (ID: ' + newObjInBobDB + ', Decoded: ' + decodedBobId + ')' : 'NO'}`);
    console.log(`   newObj in Wolis's local DB: ${newObjInWolisDB ? 'YES (ID: ' + newObjInWolisDB + ', Decoded: ' + decodedWolisId + ')' : 'NO'}`);

    if (!newObjInBobDB || !newObjInWolisDB) {
      throw new Error('FAILED: Created newObj was not replicated to local DBs!');
    }

    if (decodedBobId < 23) {
      throw new Error(`FAILED: Expected new object ID to be over 23, but got ID "${newObjInBobDB}" (Decoded: ${decodedBobId})`);
    }

    await wolis.sendCommand({ cmd: `create a red bus` });
    await wolis.sendCommand({ cmd: `get it` });
    await wolis.sendCommand({ cmd: `drop it` });
    await bob.sendCommand({ cmd: `get the bus` });
    await bob.sendCommand({ cmd: `drop the bus` });
    await wolis.sendCommand({ cmd: `paint it dodgerblue` });

    await wolis.sendCommand({ cmd: `create a green frog` });
    await bob.sendCommand({ cmd: `put the frog on the bus` });
    await bob.sendCommand({ cmd: `pose it as sitting` });
    // Wait for SSE broadcast
    await initApp.utils.sleep(600);
    await wolis.sendCommand({ cmd: `look` });
    console.log('   Wolis heard:', wolis.ui.messages[wolis.ui.messages.length - 1]);
    await wolis.sendCommand({ cmd: `get the frog` });

    await wolis.sendCommand({ cmd: `build a shed` });
    await wolis.sendCommand({ cmd: `create 3 white cups` });
    await bob.sendCommand({ cmd: `get the cups` });
    // Wait for SSE broadcast
    await initApp.utils.sleep(600);
    await wolis.sendCommand({ cmd: `look` });
    console.log('   Wolis heard:', wolis.ui.messages[wolis.ui.messages.length - 1]);

    await wolis.sendCommand({ cmd: `go shed` });
    await initApp.utils.sleep(600);
    console.log(`wolis is now in `, wolis.player.info.loc);
    await wolis.sendCommand({ cmd: `drop the frog` });

    if (wolis.player.info.loc === '_2') {
      throw new Error(`FAILED: Expected wolis to be in new location not in _2 starting location`);
    }



    // 6. Test Chat & Spatial Filtering over SSE
    console.log('\n-----------------------------------------------------');
    console.log('TEST 4: Spatial Chat & Message Filtering');
    console.log('-----------------------------------------------------');
    const janeMsgCountBefore = jane.ui.messages.length;

    await bob.sendCommand({ cmd: 'say hello Wolis in the house' });

    // Wait for SSE broadcast
    await initApp.utils.sleep(600);

    console.log('   Wolis heard:', wolis.ui.messages[wolis.ui.messages.length - 1]);
    const janeMsgCountAfter = jane.ui.messages.length;
    console.log(`   Jane (in Library loc 3) received new messages: ${janeMsgCountAfter - janeMsgCountBefore} (Expected: 0)`);

    if (janeMsgCountAfter !== janeMsgCountBefore) {
      throw new Error('FAILED: Jane received message from another room!');
    }

    console.log('\n=====================================================');
    console.log('           ALL MULTI-USER TESTS PASSED!              ');
    console.log('=====================================================\n');
  } finally {
    await wolis.db.saveToDisk();
    // Close SSE streams cleanly so process can exit
    wolis.sse.close();
    bob.sse.close();
    jane.sse.close();
  }
  await app.tester.deleteTestContexts();
  await app.tester.deleteTestLogs();
  process.exit(0);
}

runMultiUserSimulation().catch(err => {
  console.error('Error during simulation:', err);
  process.exit(1);
});

