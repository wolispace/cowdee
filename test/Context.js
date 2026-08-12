import fs from "fs";

import { Utils } from '../public/classes/Utils.js';
import { IO } from '../public/classes/IO.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { PlayerManager} from '../public/classes/PlayerManager.js';
import { LookManager} from '../public/classes/LookManager.js';
import { Context} from '../public/classes/Context.js';

// simulate the app
const app = {
  seen: () => {return(false)},
  playerInfo: { id: 'wol', loc: '2' },
  ui: { addMessage: (context) => {console.log('msg', context.msg)} },
}

app.utils = new Utils(app); // random utils
app.io = new IO(app); // disk IO - read and write to server
app.db = new DB(app); // database - read and write objects
app.id = new ID(app); // generate unique sequential ids
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
  
  const context = new Context(rawContext);
  await context.process();
  context.cmd = 'say hello';
  await context.process();
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

  