import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMultiUserSimulation() {
  console.log('=====================================================');
  console.log('       COWDEE MULTI-USER REAL-APP TEST               ');
  console.log('=====================================================\n');

  // 1. Initialize DB fixtures
  const initApp = new App({settings: { name: 'initApp', generate: true, max: 5 } });
  initApp.tester = new Tester(initApp);
  initApp.tester.deleteTestFiles();
  await initApp.tester.initObjects();
  await initApp.tester.initPlayers();
  await initApp.tester.initCommands();
  await initApp.db.savePoolsToDisk();
  console.log(`✔ Initialized test database fixtures. DB Counter: ${initApp.id.counter}\n`);

  // 2. Create 3 independent real App instances and connect to SSE / Server
  const wolis = new App({settings: {name: 'wolisApp'}});
  const bob = new App({settings: {name: 'bobApp'}});
  const jane = new App({settings: {name: 'janeApp'}});

  await wolis.db.flush();
  await bob.db.flush();
  await jane.db.flush();

  await wolis.start();
  await bob.start();
  await jane.start();

  // Allow initial SSE handshake
  await sleep(300);

  try {
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

    // 5. Test Object creation & replication across clients over SSE
    const newObjName = 'pig';
    console.log('\n-----------------------------------------------------');
    console.log(`TEST 3: Bob creates a pink ${newObjName} in Room 2`);
    console.log('-----------------------------------------------------');
    await bob.sendCommand({ cmd: `create a pink ${newObjName}` });

    // Wait for SSE broadcast across network/server
    await sleep(600);

    const newObjInBobDB = await bob.db.findByNameInLoc(newObjName, '2');
    const newObjInWolisDB = await wolis.db.findByNameInLoc(newObjName, '2');
    const decodedBobId = newObjInBobDB ? bob.id.decodeInt(newObjInBobDB) : -1;
    const decodedWolisId = newObjInWolisDB ? wolis.id.decodeInt(newObjInWolisDB) : -1;

    console.log(`   newObj in Bob's local DB:   ${newObjInBobDB ? 'YES (ID: ' + newObjInBobDB + ', Decoded: ' + decodedBobId + ')' : 'NO'}`);
    console.log(`   newObj in Wolis's local DB: ${newObjInWolisDB ? 'YES (ID: ' + newObjInWolisDB + ', Decoded: ' + decodedWolisId + ')' : 'NO'}`);

    // wolis.storage.dump();
    // bob.storage.dump();

    if (!newObjInBobDB || !newObjInWolisDB) {
      throw new Error('FAILED: Created newObj was not replicated to local DBs!');
    }

    if (decodedBobId < 23) {
      throw new Error(`FAILED: Expected new object ID to be over 23, but got ID "${newObjInBobDB}" (Decoded: ${decodedBobId})`);
    }

    // 6. Test Chat & Spatial Filtering over SSE
    console.log('\n-----------------------------------------------------');
    console.log('TEST 4: Spatial Chat & Message Filtering');
    console.log('-----------------------------------------------------');
    const janeMsgCountBefore = jane.ui.messages.length;

    await bob.sendCommand({ cmd: 'say hello Wolis in the house' });

    // Wait for SSE broadcast
    await sleep(600);

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
    await wolis.db.savePoolsToDisk();
    // Close SSE streams cleanly so process can exit
    wolis.sse.close();
    bob.sse.close();
    jane.sse.close();
  }

  process.exit(0);
}

runMultiUserSimulation().catch(err => {
  console.error('Error during simulation:', err);
  process.exit(1);
});

