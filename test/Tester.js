import { info } from 'node:console';
import { Context } from '../public/classes/Context.js';

export class Tester {
  constructor(app) {
    this.app = app;

    console.log('CWD:', process.cwd());

    // a context to use for creating new objects so they have the same seed
    const rawContext = {
      ts: 12345,
      actor: this.app.player.id,
      loc: this.app.player.loc,
      cmd: 'do nothing',
      counter: this.app.id.counter,
    };
    rawContext.app = app; // stuff the app into the context object

    this.context = new Context(this.app, rawContext);

  }

  async deleteTestFiles() {
    console.log('flushed memory');
    this.app.db.flush();
    console.log('removing files');
    await fetch('http://localhost/_emptyDB.php');
    await fetch('http://localhost/_emptyContexts.php');
    if (typeof localStorage !== 'undefined') {
      try { localStorage.clear(); } catch (e) { }
    }
  }

  async deleteTestContexts() {
    console.log('removing contexts');
    await fetch('http://localhost/_emptyContexts.php');
  }

  async deleteTestLogs() {
    console.log('removing logs');
    await fetch('http://localhost/_emptyLog.php');
  }

  randomName() {
    const names = ['mouse', 'hat', 'card', 'book', 'pen', 'frog', 'table', 'chair', 'basket']
    return names[this.context.random(names.length)];
  }

  randomColor() {
    const names = this.app.ui.colorNames();
    return names[this.context.random(names.length)];
  }

  async initObjects() {
    const startingLocId = this.app.id.new();
    const wolisId = this.app.id.new();
    const libraryId = this.app.id.new();
    const libraryDoorId = this.app.id.new();
    const bookOfBasicsId = this.app.id.new();
    const bookOfOtherId = this.app.id.new();
    const materialBoxId = this.app.id.new();

    let obj = {
      id: startingLocId,
      class: 'Old village',
      qty: 0,
      owner: wolisId,
      loc: '__',
      color: 'tan',
      lock: 1,
    };
    await this.app.db.save(obj);

    obj = {
      id: wolisId,
      class: 'player',
      name: 'Wolis',
      qty: 1,
      owner: wolisId,
      loc: startingLocId,
      color: 'goldenrod',
      lock: 1,
      pw: "$2b$10$KrEhOb\/LpXNnqimUWwfKdO\/IITbgYbtImzEHQQZ\/a5OV\/VjoDU.3q",
      info: 'Creator of COW',
    };
    await this.app.db.save(obj);

    obj = {
      id: this.app.id.new(),
      loc: startingLocId,
      class: 'sign',
      color: 'white',
      owner: wolisId,
      qty: 1,
      lock: 1,
      info: `Type short commands and press Enter. 

      type: [read the book of basics]

type: [look] shows you where you are.
type: [say hello], type: [think I wonder if..] and type: [do sits down] are ways of communicating with others

NOTE: This is a test DB so anything you create will be lost!

You can create objects like type: [create a book] or type: [create a table]
You can paint, put, pose and push objects eg 
type: [paint the table orange] or type: [paint the table] (to use the colour picker)
type: [put the book on the table]
type: [pose the book as sitting]
type: [push the book] (so its not sitting on the table)

You can get and drop things and use type: [inv] to see what you are carrying.

New locations can be built in two ways:
type: [build a castle]
or
type: [build a bridge to a castle]
You can go to different locations eg: type: [go castle] or type: [go bridge]

You can edit objects eg type: [edit the book] then eveyrone can type: [examine the book] while type: [read the book] should work from anywhere so books in the pibrary can be read without standing near them.

You can also code objects but you need to know about CowScript for this.

If you get stuck, try reloading the browser, or type: [goto bob] to teleport to the player Bob wherever they are right now.`
    };
    await this.app.db.save(obj);
    
    obj = {
      id: libraryId,
      class: 'library',
      qty: 1,
      owner: wolisId,
      loc: startingLocId,
      color: 'lightslategrey',
      lock: 1,
      link: libraryDoorId,
    }
    await this.app.db.save(obj);

    obj = {
      id: libraryDoorId,
      class: 'front door',
      qty: 1,
      owner: wolisId,
      loc: libraryId,
      color: 'tan',
      lock: 1,
      link: libraryId,
    }
    await this.app.db.save(obj);

    // make the book of basics
    obj = {
      id: bookOfBasicsId,
      class: 'book of basics',
      qty: 0,
      owner: wolisId,
      loc: libraryId,
      color: 'lightblue',
      lock: 1,
      info: 'This is a book containing the basics of COW',
    }
    await this.app.db.save(obj);

    obj = {
      id: bookOfOtherId,
      class: 'book of other commands',
      qty: 0,
      owner: wolisId,
      loc: libraryId,
      color: 'lightblue',
      lock: 1,
      info: 'This is a book containing other rnadom commands',
    }
    await this.app.db.save(obj);
    
    obj = {
      id: materialBoxId,
      class: 'material box',
      qty: 0,
      owner: wolisId,
      loc: libraryId,
      color: 'tomato',
      lock: 1,
      info: 'A box bursting full of materials',
    }
    await this.app.db.save(obj);

    obj = {
      id: this.app.id.new(),
      class: 'material',
      name: 'roamer',
      qty: 1,
      owner: wolisId,
      loc: materialBoxId,
      color: 'white',
      lock: 1,
      info: 'Randomly roams around',
      code: `##tick:runsub doit;
##doit: if $actor's steps > 8 then delme else moveme;
##moveme: find $loc, random doorway;go $found_id;
##delme: say 'bye', "[$actor] dissapears in a puff of logic";delete $actor;`,
    }
    await this.app.db.save(obj);


    // create the commands in two books
    const basicCommands = [
      {
      name: "say",
      info: `Say something to everyone in your location 
eg: type: [say Hi there] type: [say What am I doing here?]`,
      code: `get $text,$rel,$target in $loc;\nif $target > 0 then sayto else saytext;\n\n##sayto:\nif $niceness > 0 then saynice;\nif $text like "?" then asktoit else saytoit;\n##asktoit:\nsay 'ask',"[$actor] $prefix asks [$target] '$text'";\n##saytoit:\nsay 'say',"[$actor] $prefix says '$text' to [$target]";\n\n##saytext:\nget $text;\nif $niceness > 0 then saynice else saynormal;\nif $text like "?" then askit else sayit;\n##askit:\nsay 'ask',"[$actor] $prefix asks '$text'";\n##sayit:\nsay 'say',"[$actor] $prefix says '$text'";\n\n##saynice:\nvar $prefix to (sweetly,nicely,politely);`,
    }, {
      name: "think",
      info: `Let others in your location know what your thinking
eg: type: [think I keep thinking its Tuesday] or type: [think] to just think randomly`,
      code: `get $text;\nif $text ne '' then thinkit else ponder;\n##thinkit:\nsay 'think',"[$actor] .oO( $text )";\n##ponder:\nsay 'think',"[$actor] .o0( I keep thinking its Tuesday )"`
    }, {
      name: "shout",
      info: `Shout something to everyone in the world
eg: type: [shout Hello everyone!]`,
      code: `get $text;\nif $text ne 'shout' then shoutit else fail;\n##shoutit:\nmsg 0,$actor,0,0,'shout',"You hear [$actor] shout '$text!'",$actor;\n##fail:\nvar $mm to (Hello,Hay,Bingo,Ahoy there mates,Its life Jim,Horse,Four,My my,AAARGH);\nmsg 0,$actor,0,0,'shout',"[$actor] shouts '$mm!'",$actor;`
    }, {
      name: "do",
      info: `Show everyone in your locationw hat you are doing
eg: type: [do sits down] or type: [do claps]. `,
      code: `get $text;\nif $text ne '' then doit else fail;\n##doit:\nsay 'action',"[$actor] $text";\n##fail:\nvar $text to (claps,dances around the room,sits down);\nrunsub doit;`
    }, {
      name: "create",
      info: `Create a new object
eg: type: [create a book] or type: [create a table]`,
      code: `get $text;\nnew $text;\nsay 'create',"[$actor] creates [$target]";\nrelook $loc;`
    }, {
      name: "look",
      info: `Look at your current location
eg: type: [look]`,
      code: `say 'look',"[$actor] looks around";\nrelook $loc;`
    }, {
      name: "put",
      info: `Put an object relative to another
eg: type: [put the book on the table] or type: [put the mouse behind the fridge]. Then you can pose it type: [pose the mouse as sleeping]`,
      code: `get $target,$rel,$second in $loc,$loc;\nset $target's hosthow to "$rel";\nset $target's host to $second;\nset $target's hosthow to "$rel";\nset $target's pose to '';\nsay 'put',"[$actor] put [$target] $rel [$second]";\nrelook $loc;`
    }, {
      name: "push",
      info: `Push an object. 
eg: type: [push the book] to seperate it from it's host and pose. 
If a book was on a table and posed as sitting, it would simply be a book after being pushed.`,
      code: `get $target in $loc;\nclear $target,all;\nsay 'push',"[$actor] pushes [$target]";\nrelook $loc;`
    }, {
      name: "pose",
      info: `Pose an object
eg: type: [pose the book as sitting] or type: [pose the bird as flying]`,
      code: `get $target,''as',$text,non-greedy in $loc;\nset $target's pose to $text;\nsay 'pose',"[$actor] poses [$target] as $text";\nrelook $loc;`
    }, {
      name: "go",
      info: `Go to a location
eg: type: [go castle] or type: [go road] to go wherever the road leads`,
      code: `get $target in $loc; go $target;`
    }, {
      name: "delete",
      info: `Delete an object
eg: type: [delete the book]`,
      code: `get $target in $loc;delete $target;`
    }, {
      name: "build",
      info: `Build a new location
eg: type: [build a castle] or type: [build a bridge to a castle]`,
      code: `get $text,'to',$text2;\nif $text2 ne '' then complex else simple;\n\n##complex:\nnew $text;\nvar $door1 to $new_id;\ncopy $new_id;\nvar $door2 to $new_id;\nnew $text2;\nupdate $new_id to "worth=0, loc=$door1, pose='hidden'";\nset $new_id's pwd to $actor's pwd; \nupdate $door2 to "loc=$new_id, link=$door1, color='paleblue', worth=0, material='_door_'";\nupdate $door1 to "link=$door2, color='tomato', worth=0, material='_door_'";\nsay 'create',"[$actor] built [$door1] to somewhere $rather interesting";\nrelook $loc;\n\n##simple:\nnew exit;\nvar $exit to $new_id;\nnew $text;\nupdate $new_id to "link=$exit, color='lightgreen'";\nupdate $exit to "link=$new_id, loc=$new_id, extra='from here', qty=1, class='exit', color='lightgreen'";\nsay 'create',"[$actor] built [$new_id]";\nrelook $loc;`
    }, {
      name: "paint",
      info: `Paint an object a certain colour
eg: type: [paint the table orange] or type: [paint the table] (to use the colour picker)`,
      code: `get $target,$lastword in $loc;\nif $lastword ne '' then paintit else picker;\n##picker:\ncolorpicker;\n##paintit:\nset $target's color to $lastword;\nsay 'paint',"[$actor] paints [$target] $lastword";\nrelook $loc;`
    }, {
      name: "get",
      info: `Get something from your current location
eg: type: [get the book]`,
      code: `get $target in $loc;\nunhost $target;\nclear $target,all;\nset $target's pose to "";\nset $target's loc to $actor;\nsay 'gets',"[$actor] gets [$target]";\nrelook $loc;\nvar $loc to $actor;\n msg $loc,$actor,$target,0,'arrives',"[$target] appears from nowhere";\nrelook $actor's loc;`
    }, {
      name: "drop",
      info: `Drop something you are carrying
eg: type: [drop the book]`,
      code: `get $target in $actor;\nvar $dest to $actor's loc;\nset $target's loc to $dest;\nsay 'drops',"[$actor] drops [$target]";\nvar $loc to $dest;\nrelook $loc;\nvar $loc to $actor;\nsay 'gone',"[$target] has gone";\nrelook $actor's loc;`
    }, {
      name: "inv",
      info: `Show what you are carrying
eg: type: [inv]`,
      code: `list $actor;\n`
    }, {
      name: "read",
      info: `Read the text of an object
You can read any book even if it's in a dofferent location
eg: type: [read the book of basics]`,
      code: `get $target;\nsay 'read',"[$actor] reads [$target]";\rread $target;`
    }, {
      name: "examine",
      info: `Examine the details of an object
eg: type: [examine the table]`,
      code: `get $target in $loc;\nsay 'examine',"[$actor] examines [$target]";\nexamine $target;`
    }, {
      name: "edit",
      info: `Edit what people see when they examine or read an object
eg: type: [edit the book]`,
      code: `get $target in $loc;\nsay 'edit',"[$actor] starts to edit [$target]";\nedit $target;`
    }
    ];

    const otherCommands = [
    { 
      name: "about",
      info: `Show info about this current instance of COW`,
      code: `about;`
    }, {
      name: "exit",
      info: `Go through first 'exit' object in a location. HOpefully there is only one. type: [exit]`,
      code: `find $loc, exit; go $found_id;`
    }, {
      name: "find",
      info: `Find an object. eg: type: [find the book]`,
      code: `get $target;\nvar $dest to $target's loc;\nif $target > 0 then itshere else fail;\n##itshere:\nvar $dest to $target's loc;\nsay 'msg',"[$actor] finds [$target] in [$dest]";\n##fail;\nsay 'msg',"[$actor] wants to find '$cmd_text' but has no idea where to start looking";`
    }, {
      name: "list",
      info: `List all the objects in your current location`,
      code: `list $loc;`
    }, {
      name: "goto",
      info: `Teleport to another object eg type: [goto sign] or type: [goto wolis] to goto player Wolis no matter where he is`,
      code: `get $target;clear $actor,all;\nset $actor's loc to $target's loc;\nsay 'leaves',"[$actor] dissapears in a puff of smoke";\nvar $loc to $target's loc;\nsay 'arrives',"[$actor] appears out of thin air!";\nrelook $loc;`
    }, {      
      name: "into",
      info: `Go inside (yes inside!) any object. eg type: [create a box] type: [into box]`,
      code: `set $oldloc to $loc;\nget $target in $loc;\nsay 'leaves',"[$actor] disapears inside [$target]!";\nset $loc = $target;\nset $actor's loc to $loc;\nrelook $loc;\nrelook $oldloc;`
    }, {
      name: "outof",
      info: `Pop outside of an object you went into. eg type: [create a box] type: [into box] type: [outof]`,
      code: `set $target = $loc;\nset $loc = $target's loc;\nset $actor's loc to $loc;\nsay 'arrives',"[$actor] apears outside [$target]!";\nrelook $loc;`
    }, {      
      name: "flush",
      info: `Flush your db memory. I wonder if anyone will ever need this?`,
      code: `flush;say 'flush',"[$actor] flushed the pools";`
    }, {
      name: "copy",
      info: `Make a copy of an object. eg: type: [copy the book]`,
      code: `get $target in $loc;\ncopy $target;\nsay 'copy', "[$actor] copies [$target]";\nrelook $loc;`
    }, {
      name: "code",
      info: `Edit the code of an object`,
      code: `get $target in $loc;\nsay 'code',"[$actor] starts to code [$target]";\ncode $target;`
    }, {
      name: "lock",
      info: `Lock an object so that only its owner can edit it`,
      code: `get $target in $loc;\nset $target's lock = 1;\nsay 'lock', "[$actor] locks [$target]";\nrelook $loc;`
    }, {
      name: "unlock",
      info: `Unlock an object so that anyone can edit it`,
      code: `get $target in $loc;\nset $target's lock = '';\nsay 'unlock', "[$actor] unlocks [$target]";\nrelook $loc;`
    }, {
      name: "link",
      info: `Link two objects together to make a doorway between them. eg: type: [link the door to the portal]`,
      code: `get $target,'to',$second in $loc;\nset $target's link = $second;\nset $second's link = $target;\nsay 'link', "[$actor] links [$target] to [$second]";\nrelook $loc;`
    }, {
      name: "lochow",
      info: `change how the location is described`,
      code: `get $text;set $loc's lochow = $text;say 'change', '[$actor] tinkers with [$loc]';relook $loc;`
    }, {
      name: "material",
      info: `set a material to an object`,
      code: `get $target,'to',$text;set $target's material = $text;say 'change', '[$actor] sets [$target] to $text";`
    }, {      
      name: "point",
      info: `Point at something in your current location`,
      code: `find $loc, random not me;\nsay 'point', "[$actor] points at [$found_id]";`
    }
   ];


    await this.initCommands(basicCommands, bookOfBasicsId, wolisId);
    await this.initCommands(otherCommands, bookOfOtherId, wolisId);

  }



  async initCommands(commands, loc, owner) {
    for (const obj of commands) {
      obj.id = this.app.id.new();
      obj.loc = loc;
      obj.class = 'command';
      obj.qty = 1;
      obj.lock = 1;
      obj.owner = owner,
      obj.color = this.randomColor();
      await this.app.db.save(obj);
    }
  }


  async oldObjs() {
    
    const fridge = {
      id: this.app.id.new(),
      loc: '_2',
      class: 'fridge',
      color: 'white',
      owner: '_wol',
      qty: 1,
      code: `if reacting to say then pushit;##pushit:\nfind $loc, sign;\nsay 'push', "[$actor] pushes [$found_id]";##tick:runsub noiseit/5;##noiseit:$how = (quietly,loudly,abruptly);$noise = (gurgles,pops,dings,groans,wheezes);say 'do',"[$actor] $how $noise";##tiXckhour:say 'think',"[$actor] .oO( Brrr );`,
      info: `Do not type: [push the fridge] or type: [shout hello]`
    };
    await this.app.db.save(fridge);

    const bunny = {
        id: this.app.id.new(),
      loc: '_2',
      class: 'bunny',
      color: 'pink',
      owner: '_wol',
      movehow: 'hops',
      qty: 1,
      code: `##tick:runsub doit;
      ##doit: if $actor's steps > 8 then delme else moveme;
      ##moveme: find $loc, random doorway;go $found_id;
      ##delme: say 'bye', "[$actor] dissapears in a puff of logic";delete $actor;`,
      info: `Im a roaming temporary bunny`
    };
    // await this.app.db.save(bunny);

    const beachball = {
        id: this.app.id.new(),
      loc: '_2',
      class: 'ball',
      color: 'dodgerblue',
      owner: '_wol',
      movehow: 'bounces',
      qty: 1,
      code: `if target of push then doit;
      ##doit: if $actor's steps > 2 then delme else moveme;
      ##moveme: say 'step', "[$actor] has moved [$actor.steps]";set $actor's blip = 'ONE';find $loc, random doorway;go $found_id;
      ##delme: say 'bye', "[$actor] dissapears in a puff of logic";delete $actor;`,
      info: `type: [push the ball];`
    };
    await this.app.db.save(beachball);

  }
} 