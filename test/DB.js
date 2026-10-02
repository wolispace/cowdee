import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({settings: { name: 'initApp', generate: true, max: 3 } });

app.tester = new Tester(app);



console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.tester.deleteTestFiles();
  await app.tester.initObjects(app.settings.max);
  await app.tester.initPlayers();
  await app.tester.initCommands();
  await app.db.saveToDisk();
  console.log(`✔ Initialized test database fixtures. DB Counter: ${app.id.counter}\n`);
  
  await app.start();  
  await app.player.handleLogon({ playername: 'Wolis' });
  await app.utils.sleep(300);
  await app.sendCommand({ cmd: `build a shed` });
  await app.sendCommand({ cmd: `create a red bus` });
  await app.utils.sleep(300);

  await app.db.saveToDisk();
  const ticking = await app.db.get('tick', '__');
  console.log(`${app.name} -- ticking =`, ticking);
}
 
console.log('-------------- END ----------------');
process.exit(0);
