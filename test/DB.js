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
    lock it
    build a bakery
    paint it darkkahki
    lock it
    build a road to a bridge
    lock the road
    paint it tan
    go road
    lochow on
    create a fisherman
    paint it olive
    lock it
    lock the road
    paint it tan
  `;
  for(const cmd of playerCommands.split('\n')) {
    if (cmd.trim()) {
      await app.sendCommand(cmd);
      await app.utils.sleep(300);
    }
  }
  
  await app.utils.sleep(300);
  await app.db.saveToDisk();

  // find the fisherman and have them say something on a tick
  const fisherman = await app.db.getObjByName('fisherman');
  if (fisherman) {
    console.log({fisherman});
    fisherman.info = `I'm just minding my own business. Best not [type: push fisherman]`;
    fisherman.code = `if reacting to push then pushit;
  ##pushit:
  $msg = (Hmm... what?, Yup... I'm real, I'll just ignore that);
  say 'say', "[$actor] says '$msg'";
  ##tick:runsub noiseit/3;
  ##noiseit:
  $how = (quietly, loudly, abruptly, slowly, hipnotically, gruffly);
  $noise = (hums, whistles, scans the horizon, squints at the sun, scratches his head, groans, wheezes, coughs, smiles, winks, fishes, sits down, paces about);
  say 'do', "[$actor] $how $noise";`;
    await app.db.save(fisherman);
    await app.db.saveToDisk();
  }

  await app.tester.deleteTestContexts();
  await app.tester.deleteTestLogs();

  const ticking = await app.db.get('tick', '__');
  console.log(`${app.name} -- ticking =`, ticking);
}
 
console.log('-------------- END ----------------');
process.exit(0);
