import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({settings: { name: 'initApp', generate: true, max: 3 } });

app.tester = new Tester(app);

console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.player.info.id = 'wol';
  app.tester.deleteTestFiles();
  await app.tester.initObjects(app.settings.max);
  await app.tester.initPlayers();
  await app.tester.initCommands();

  await app.db.saveToDisk();
}
 
console.log('-------------- END ----------------');
process.exit(0);
