
import { Utils } from '../public/classes/Utils.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { IO } from '../public/classes/IO.js';
import { Context } from '../public/classes/Context.js';
import { Tester } from './Tester.js';

// simulate the app
const app = {
  debug: true,
  seen: () => { return (false) },
  playerInfo: { id: 'wol', loc: '2' },
  settings: {
    generate: true,
    max: 5,
  }
}

app.utils = new Utils(app);
app.io = new IO(app);
app.db = new DB(app);
app.id = new ID(app);
app.tester = new Tester(app);

console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.io.flush();
  app.tester.deleteTestFiles();
  await app.tester.initObjects();
  await app.tester.initPlayers();
  await app.tester.initCommands();
  await app.db.savePoolsToDisk();
}


console.log('-------------- END ----------------');

