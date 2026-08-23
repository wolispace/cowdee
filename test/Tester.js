import fs from "fs";
import path from "path";
import { Context } from '../public/classes/Context.js';

export class Tester {

   counterFile = '_db/_counter.txt';

  constructor(app) {
    this.app = app;
    if (fs.existsSync(this.counterFile)) {
      const val = parseInt(fs.readFileSync(this.counterFile, 'utf8'), 10);
      if (!isNaN(val) && val > 0) {
        this.app.id.counter = val;
      }
    }

    console.log('CWD:', process.cwd());

    // a context to use for creating new objects so they have the same seed
    const rawContext = {
      ts: 12345,
      actor: this.app.player.info.id,
      loc: this.app.player.info.loc,
      cmd: 'do nothing',
      counter: this.app.id.counter,
    };
    rawContext.app = app; // stuff the app into the context object

    this.context = new Context(this.app, rawContext);

  }

  deleteTestFiles() {
    console.log('flushing memory');
    this.app.io.flush();
    console.log('removing files');
    const dir = "_db";
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith(".json")) {
        fs.rmSync(path.join(dir, file), { force: true });
      }
    }
    const contextDir = "_contexts";
    if (fs.existsSync(contextDir)) {
      for (const file of fs.readdirSync(contextDir)) {
        if (file.endsWith(".json")) {
          fs.rmSync(path.join(contextDir, file), { force: true });
        }
      }
    }
    if (typeof localStorage !== 'undefined') {
      try { localStorage.clear(); } catch (e) {}
    }
    this.app.id.counter = 1;
    fs.writeFileSync(this.counterFile, '1');
  }


  randomName() {
    const names = ['mouse', 'hat', 'card', 'book', 'pen', 'frog', 'table', 'chair', 'basket']
    return names[this.context.random(names.length)];
  }

  randomColor() {
    const names = ['wheat', 'seagreen', 'teal', 'tomato', 'dodgerblue', 'slategrey', 'plum', 'brick']
    return names[this.context.random(names.length)];
  }


  async initObjects() {
    let counter = 0;
    while (counter++ < this.app.settings.max) {
      const obj = {
        id: this.app.id.new(),
        class: this.randomName(),
        qty: 1,
        loc: this.app.id.encodeInt(this.context.random(this.app.settings.max)),
        color: this.randomColor()
      };
      //  obj.info = `It's a pretty ordinary ${obj.class}`;
      await this.app.db.save(obj);
      if (counter % 10 === 0) {
        process.stdout.write(":");
      }
    }
    const house = await this.app.db.getById('2');
    const old1 = { ...house };
    house.class = 'house';
    house.loc = '0';
    await this.app.db.save(house, old1);

    const library = await this.app.db.getById('3');
    const old2 = { ...library };
    library.class = 'library';
    library.loc = '0';
    await this.app.db.save(library, old2);
  }

  async initPlayers() {
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
      await this.app.db.save(obj);
    }
  }

  async initCommands() {
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
      code: `get $target in $loc;\nunhost $target;\nclear $target,all;\nset $target's pose to \"\";\nset $target's loc to $actor;\nsay 'gets',\"[$actor] gets [$target]\";\nrelook $loc;\nvar $loc to $actor;\n msg $loc,$actor,$target,0,'arrives',\"[$target] appears from nowhere\";\nrelook $actor's loc;`
    }, {
      name: "drop",
      code: `get $target in $actor;\nvar $dest to $actor's loc;\nset $target's loc to $dest;\nsay 'drops',\"[$actor] drops [$target]\";\nvar $loc to $dest;\nrelook $loc;\nvar $loc to $actor;\nsay 'gone',\"[$target] has gone\";\nrelook $actor's loc;`
    }, {
      name: "inv",
      code: `list $actor;\n`
    }
    ];

    for (const obj of commands) {
      obj.id = this.app.id.new();
      obj.loc = '3';
      obj.class = 'command';
      obj.color = this.randomColor();
      await this.app.db.save(obj);
    }
    await this.app.id.save();
  }


} 