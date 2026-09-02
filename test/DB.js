import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({settings: { name: 'initApp', generate: true, max: 5 } });

app.tester = new Tester(app);

console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.player.info.id = 'wol';
  app.tester.deleteTestFiles();
  await app.tester.initObjects();
  await app.tester.initPlayers();
  await app.tester.initCommands();

  console.log('dirty names', app.db.pools['name'].pool.dirtyUpdated, app.db.pools['name'].pool.dirtyDeleted); 
  await app.db.savePoolsToDisk();
}

// console.log('name', app.db.pools['name'].toJson());

console.log('shard p', app.db.pools['name'].getShard('p'));

// for (const key of app.db.keys) {
//   const pool = app.db.pools[key];
//   console.log(pool.type, pool.pool.toJson());
// }
 
console.log('-------------- END ----------------');
process.exit(0);
