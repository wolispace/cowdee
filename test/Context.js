import fs from "fs";

import { Utils } from '../public/classes/Utils.js';
import { IO } from '../public/classes/IO.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { UI } from '../public/classes/UI.js';
import { Player } from '../public/classes/Player.js';
import { LookManager } from '../public/classes/LookManager.js';
import { Context } from '../public/classes/Context.js';
import { Tester } from './Tester.js';

// simulate the app
const app = {
  debug: true,
  seen: () => { return (false) },
  settings: {
    generate: true,
    max: 5,
  }
}

app.utils = new Utils(app); // random utils
app.io = new IO(app); // disk IO - read and write to server
app.db = new DB(app); // database - read and write objects
app.id = new ID(app); // generate unique sequential ids
app.ui = new UI(app); // user interface - display messages and handle input
app.io.flush();
app.player = new Player(app);
app.lookManager = new LookManager(app);
app.tester = new Tester(app);



console.log('-------------- START ----------------');

if (app.settings.generate) {
  app.io.flush();
  app.tester.deleteTestFiles();
  await app.tester.initObjects();
  await app.tester.initPlayers();
  await app.tester.initCommands();
  console.log('testing savePools after db init');
  await app.db.savePoolsToDisk();
}

await testCommands();

console.log('-------------- END ----------------');

async function testCommands() {
  app.tester.context.actor = app.player.info.id;
  app.tester.context.cmd = 'build a shed';
  app.tester.context.loc = app.player.info.loc;
  await app.tester.context.process();
  console.log('msg in',  app.tester.context.loc, app.tester.context.msg);

  app.tester.context.cmd = 'go shed';
  app.tester.context.loc = app.player.info.loc;
  await app.tester.context.process();
  console.log('msg in',  app.tester.context.loc, app.tester.context.msg);
  console.log(app.player.info);

  await app.db.savePoolsToDisk();
}

function testRandom() {
  const contexts = [];
  const dir = '_contexts';
  for (const filename of fs.readdirSync(dir)) {
    const content = JSON.parse(fs.readFileSync(`${dir}/${filename}`, `utf8`));
    const context = new Context(app, content);
    contexts.push(context);
  }

  for (const context of contexts) {
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
    context.seed = 100;
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
  }
}

