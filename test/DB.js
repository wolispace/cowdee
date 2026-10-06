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
  const playerCommands = `
    build a pantry 
    go pantry
    create a shelf
    paint it tan
    create a can of tomatoes
    paint it tomato
    put it on the shelf
    create a can of beans
    paint it green
    put it on the shelf
    create a hole
    paint it slategrey
    create a passage
    paint it slategrey
    link hole to passage
    get passage
    goto jane
    drop passage
    go passage
    exit
    create a table
    put the mouse behind the fridge
    pose the mouse as dancing
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
