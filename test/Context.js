import fs from "fs";

import { Utils } from '../public/classes/Utils.js';
import { IO } from '../public/classes/IO.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { UI } from '../public/classes/UI.js';
import { PlayerManager} from '../public/classes/PlayerManager.js';
import { LookManager} from '../public/classes/LookManager.js';
import { Context} from '../public/classes/Context.js';

// simulate the app
const app = {
  debug: true,
  seen: () => {return(false)},
  playerInfo: { id: 'wol', loc: '2' },
}

app.utils = new Utils(app); // random utils
app.io = new IO(app); // disk IO - read and write to server
app.db = new DB(app); // database - read and write objects
app.id = new ID(app); // generate unique sequential ids
app.ui = new UI(app); // user interface - display messages and handle input
app.playerManager = new PlayerManager(app);
app.lookManager = new LookManager(app);
  

console.log('-------------- START ----------------');

await testCommands();

console.log('-------------- END ----------------');

async function testCommands() {
const rawContext = {
    ts: 12345,
    actor: 'wol',
    loc: '2',
    cmd: 'think what is that?',
  };
  rawContext.app = app; // stuff the app into the context object
  
  const context1 = new Context(rawContext);
  await context1.process();
  console.log('msg', context1.msg);

  rawContext.cmd = 'say hello';
  const context2 = new Context(rawContext);
  await context2.process();
  console.log('msg', context2.msg);
  
  rawContext.cmd = 'no command';
  const context3 = new Context(rawContext);
  await context3.process();
  console.log('msg', context3.msg);

  rawContext.cmd = 'look';
  const context4 = new Context(rawContext);
  await context4.process();
  console.log('msg', context4.msg);
  
}

function testRandom() {
  const contexts = [];
  const dir = '_contexts';
  for (const filename of fs.readdirSync(dir)) {
    
    const content = JSON.parse(fs.readFileSync(`${dir}/${filename}`, `utf8`));
    const context = new Context(content);
    contexts.push(context);
  }
  
  for (const context of contexts) {
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
    context.seed = 100;
    console.log(context.seed, context.random(9), context.random(9), context.random(9));
  }
}

  