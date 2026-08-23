import fs from "fs";
import { App } from '../public/classes/App.js';
import { Context } from '../public/classes/Context.js';
import { Tester } from './Tester.js';

const app = new App({
  settings: {
    generate: true,
    max: 5,
  }
});

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
process.exit(0);

async function testCommands() {
  await app.player.handleLogon({ playername: 'Wolis' });
  console.log(` - Wolis logged in: ID="${app.player.info.id}", Loc="${app.player.info.loc}", Namespace="${app.storage.getNamespace()}"`);
    
  app.tester.context.actor = app.player.info.id;
  app.tester.context.cmd = 'build a shed';
  app.tester.context.loc = app.player.info.loc;
  await app.tester.context.process();
  console.log('msg in', app.tester.context.loc, app.tester.context.msg);

  app.tester.context.cmd = 'go shed';
  app.tester.context.loc = app.player.info.loc;
  await app.tester.context.process();
  console.log('msg in', app.tester.context.loc, app.tester.context.msg);
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
