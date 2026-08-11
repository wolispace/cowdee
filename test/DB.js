import fs from "fs";
import path from "path";
import { Utils } from '../public/classes/Utils.js';
import { DB } from '../public/classes/DB.js';
import { ID } from '../public/classes/ID.js';
import { IO } from '../public/classes/IO.js';
import { Context } from '../public/classes/Context.js';

const app = { anyDirty: false };
app.utils = new Utils(app);
app.io = new IO(app);
app.db = new DB(app);
app.id = new ID(app);

const context = new Context(app);

const settings = {
  generate: false,
  max: 5,
};

console.log('-------------- START ----------------');
app.io.flush();

if (settings.generate) {
  deleteTestFiles();
  await initObjects();
  await initPlayers();
  await initCommands();
  await app.db.savePoolsToDisk();
}

const poseIds = await app.db.findByName('pose');
console.log('pose ids', poseIds); // Set(1) { 'E' }
const poseId = poseIds.values().next().value;
const commandPose = await app.db.getById(poseId);
commandPose.code = await app.db.getCode(poseId);
console.log('command pose', commandPose);


const playerWolis = await app.db.findByNameInLoc('wol', '2');
console.log('player Wolis', playerWolis);

context.actor = 'wol';
context.loc = '2';
context.cowmand = 'go';
const commandGo = await app.db.findCommand(context);
console.log('command go', commandGo);



console.log('-------------- END ----------------');

function deleteTestFiles() {
  const dir = "./_db";
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".json")) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

function randomName() {
  const names = ['mouse', 'hat', 'card', 'book', 'pen', 'frog', 'table', 'chair', 'basket']
  return names[context.random(names.length)];
}

function randomColor() {
  const names = ['wheat', 'seagreen', 'teal', 'tomato', 'dodgerblue', 'slategrey', 'plum', 'brick']
  return names[context.random(names.length)];
}

async function initObjects() {
  let counter = 0;
  while (counter++ < settings.max) {
    const obj = {
      id: app.id.new(),
      class: randomName(),
      qty: 1,
      loc: app.id.encodeInt(context.random(settings.max)),
      color: randomColor()
    };
    //  obj.info = `It's a pretty ordinary ${obj.class}`;
    await app.db.save(obj);
    if (counter % 100 === 0) {
      process.stdout.write(":");
    }
  }
}

async function initPlayers() {
  const players = [
    { loc: '2', name: 'Wolis', id: 'wol' },
    { loc: '2', name: 'Bob', id: 'bob' },
    { loc: '3', name: 'Jane', id: 'jan' },
  ];

  for (const player of players) {
    const obj = {};
    obj.id = player.id;
    obj.loc = player.loc;
    obj.name = player.name;
    obj.class = 'player';
    obj.color = 'goldenrod';
    await app.db.save(obj);
  }
}

async function initCommands() {
  const commands = [{
    name: "say",
    code: `get $text,$rel,$target in $loc;\nif $target > 0 then sayto else saytext;\n\n##sayto:\nif $niceness > 0 then saynice;\nif $text like \"?\" then asktoit else saytoit;\n##asktoit:\nsay 'ask',\"[$actor] $prefix asks [$target] '$text'\";\n##saytoit:\nsay 'say',\"[$actor] $prefix says '$text' to [$target]\";\n\n##saytext:\nget $text;\nif $niceness > 0 then saynice else saynormal;\nif $text like \"?\" then askit else sayit;\n##askit:\nsay 'ask',\"[$actor] $prefix asks '$text'\";\n##sayit:\nsay 'say',\"[$actor] $prefix says '$text'\";\n\n##saynice:\nvar $prefix to (sweetly,nicely,politely);`,
  }, {
    name: "think",
    code: `get $text;\nif $text ne '' then thinkit else ponder;\n##thinkit:\nsay 'think',\"[$actor] .oO( $text )\";\n##ponder:\nsay 'think',\"[$actor] .o0( I keep thinking its Tuesday )\"`
  }, {
    name: "do",
    code: `get $text;\nif $text ne '' then doit else fail;\n##doit:\nsay 'action',\"[$actor] $text\";\n##fail:\nvar $text to (claps,dances around the room,sits down);\nrunsub doit;`
  }, {
    name: "create",
    code: `get $text;\nnew $text;\nsay 'create',"[$actor] creates [$target]";\nrelook $loc;`
  }, {
    name: "find",
    code: `get $target;\nvar $dest to $target's loc;\nif $target > 0 then itshere else fail;\n##itshere:\nvar $dest to $target's loc;\nsay 'msg',\"[$actor] finds [$target] in [$dest]\";\n##fail;\nsay 'msg',\"[$actor] wants to find '$cmd_text' but has no idea where to start looking\";`
  }, {
    name: "look",
    code: `say 'look',"[$actor] looks around";\nrelook $loc;`
  }, {
    name: "put",
    code: `get $target,$rel,$second in $loc,$loc;\nset $target's hosthow to \"$rel\";\nset $target's host to $second;\nset $target's hosthow to \"$rel\";\nset $target's pose to '';\nsay 'put',\"[$actor] put [$target] $rel [$second]\";\nrelook $loc;`
  }, {
    name: "push",
    code: `get $target in $loc;\nclear $target,all;\nsay 'push',\"[$actor] pushes [$target]\";\nrelook $loc;`
  }, {
    name: "pose",
    code: `get $target,\"as\",$text,non-greedy in $loc;\nset $target's pose to $text;\nsay 'pose',\"[$actor] poses [$target] as $text\";\nrelook $loc;`
  }, {
    name: "goto",
    code: `get $target;clear $actor,all;\nset $actor's loc to $target's loc;\nsay 'leaves',\"[$actor] dissapears in a puff of smoke\";\nvar $loc to $target's loc;\nsay 'arrives',\"[$actor] appears out of thin air!\";\nrelook $loc;`
  }, {
    name: "go",
    code: `get $target in $loc;\nvar $tlink to $target's link;\nsay 'leaves',\"[$actor] leaves via [$target]\";\nvar $loc to $tlink's loc;\nset $actor's loc to $loc;\nsay 'arrives',\"[$actor] appears via [$tlink]\";\nrelook $loc;`
  }, {
    name: "flush",
    code: `flush;say 'flush',"[$actor] flushed the pools";`
  }, {
    name: "build",
    code: `get $text;\nnew newexit;\nvar $exit to $new_id;\nnew $text;\nupdate $new_id to \"link=$exit, color='lightgreen'\";\nupdate $exit to \"link=$new_id, loc=$new_id, extra='from here', qty=1, class='exit', color='lightgreen'\";\nsay 'create',\"[$actor] built [$new_id]\";\nrelook $loc;`
  }, {
    name: "paint",
    code: `get $target,$lastword in $loc;\nset $target's color to $lastword;\nsay 'paint',\"[$actor] paints [$target] $lastword\";\nrelook $loc;`
  }, {
    name: "get",
    code: `get $target in $loc;\nunhost $target;\nclear $target,all;\nset $target's pose to \"\";\nset $target's loc to $actor;\nsay 'gets',\"[$actor] gets [$target]\";\nrelook $loc;\nvar $loc to $actor;\nsay 'arrives',\"[$target] appears from nowhere\";\nrelook $actor's loc;`
  }, {
    name: "drop",
    code: `get $target in $actor;\nvar $dest to $actor's loc;\nset $target's loc to $dest;\nsay 'drops',\"[$actor] drops [$target]\";\nvar $loc to $dest;\nrelook $loc;\nvar $loc to $actor;\nsay 'gone',\"[$target] has gone\";\nrelook $actor's loc;`
  }, {
    name: "inv",
    code: `list $actor;\n`
  }
  ];

  for (const obj of commands) {
    obj.id = app.id.new();
    obj.loc = '3';
    obj.class = 'command';
    obj.color = randomColor();
    await app.db.save(obj);
  }
}
