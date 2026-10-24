import { App } from '../public/classes/App.js';
import { Tester } from './Tester.js';

const app = new App({settings: { name: 'initApp', generate: true, max: 3 } });
app.tester = new Tester(app);

console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.tester.deleteTestFiles();
  await app.tester.initObjects(app.settings.max);
  console.log(`✔ Initialized test database fixtures. DB Counter: ${app.id.counter}\n`);
  
  await app.start();  
  await app.player.handleFindPlayer({ playername: 'Wolis' });
  await app.utils.sleep(300);
  const playerCommands = `
    create a fountain
    paint it lightblue
    build a bakery
    paint it darkkahki
  `;
  for(const cmd of playerCommands.split('\n')) {
    if (cmd.trim()) {
      await app.sendCommand(cmd);
      await app.utils.sleep(300);
    }
  }
  
  await app.utils.sleep(300);
  await app.db.saveToDisk();
  await app.tester.deleteTestContexts();
  await app.tester.deleteTestLogs();

  const ticking = await app.db.get('tick', '__');
  console.log(`${app.name} -- ticking =`, ticking);
}
 
console.log('-------------- END ----------------');
process.exit(0);
