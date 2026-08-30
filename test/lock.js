import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

console.log('-------------- START ----------------');

const wolis = new App({settings: {name: 'wolisApp'}});
// attach the tester class so we can rebuild the test objects
wolis.tester = new Tester(wolis);
wolis.tester.deleteTestFiles();
await wolis.tester.initObjects();
await wolis.tester.initPlayers();
await wolis.tester.initCommands();
await wolis.db.savePoolsToDisk();
await wolis.player.handleLogon({ playername: 'Wolis' });
await wolis.start();

const bob = new App({settings: {name: 'bobApp'}});
await bob.player.handleLogon({ playername: 'Bob' });
await bob.start();



let wolIsLocked = await wolis.io.tryLock();
console.log({wolIsLocked});

let bobIsLocked = await bob.io.tryLock();
console.log({bobIsLocked});

wolIsLocked = await wolis.io.tryLock();
console.log({wolIsLocked});

wolIsLocked = await wolis.io.unLock();
console.log({wolIsLocked});

bobIsLocked = await bob.io.tryLock();
console.log({bobIsLocked});

bobIsLocked = await bob.io.unLock();
console.log({bobIsLocked});

await wolis.sendCommand({ cmd: `create a fish` });
await wolis.sendCommand({ cmd: `examine the fish` });


wolis.sse.close();
bob.sse.close();


// const obj = app.db.getById('2');
// obj.color = 'dodgerblue';
// app.db.save(obj);

// await app.db.savePoolsToDisk();

console.log('-------------- END ----------------');
process.exit(0);
