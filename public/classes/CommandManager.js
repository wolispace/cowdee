import { Queue } from './Queue.js';

export class CommandManager extends Queue {

  subs = {};
  context = {}; // the context the statement is run agains (which actor which location etc..)
  relWords = 'at|as|to|on|in|near|far from|far away from|away from|under|between|above|around|encompassing|beside|behind|leaning against|next to|through|against|with|by|over|across|facing|leaning|looking|leading|heading|pointing|going|running|to the|north|east|west|south|up|down|from|off';

  constructor(app) {
    super();
    this.app = app;
  }

  // TODO: remove http code as this is pure js/json now
  handle(request, result) {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      const userCommand = JSON.parse(body);
      // DEBUG:
      if (userCommand.cmd.includes('dump')) {
        this.app.db.dump();
      }
      // userCommand = {actor: 'w', loc: '2', cmd: 'create a small black cat', lastt='X'}
      this.add(userCommand);
      result.writeHead(200, { 'Content-Type': 'application/json' });
      result.end(JSON.stringify({ ok: true }));
      this.app.doNext();
    });
  }

  /**
   * Take the next userCommand off the queue and parse it and process the bits
   */
  doNext() {
    if (this.pending()) {
      const userCommand = this.get();
      this.parse(userCommand);
    }
  }

  show() {
    console.log(`\n--- Commands in queue: ${this.pending()} ---`);
    this.queue.forEach((cmd, i) => {
      console.log(`cmd ${i + 1}:`, cmd);
    });
  }


  /**
   * parse user input (specifically focusing on 'say')
   * @param {object} commandObj { cmd: "say hello everyone", actor: "w", loc: "A", niceness: 0 }
   */
  parse(commandObj) {
    //console.log({commandObj});
    // reset reactions after a human sends something
    this.app.db.reactions = 0;
    const rawCmd = commandObj.cmd;
    if (!rawCmd) return;

    const { firstword, rest } = this.splitFirstWord(rawCmd);
    // Build execution context
    this.context = {
      actor: commandObj.actor || commandObj.id,
      loc: commandObj.loc,
      niceness: commandObj.niceness || 0,
      lastt: commandObj.lastt || '',
      cmd_text: rest,
      prefix: '',
      text: '',
      rel: '',
      target: ''
    };
    // add
    const objs = {}
    objs[this.context.actor] = this.app.db.getFormattedById(this.context.actor);

    const code = this.app.db.findCommand(firstword, this.context);
    if (!code) {
      this.app.messageManager.add({
        msg: `{${this.context.actor}} tries to ${rawCmd}, but nothing happens`,
        objs: objs,
        context: this.context
      });
      return;
    };
    this.runCodeFrom(code, '__start');
  }

  /**
   * Sets up the context to run the code from the block
   * @param {string} code 
   * @param {string} block 
   * @param {object} context 
   */
  runCodeFrom(code, block, context = this.context) {
    this.context = context;
    // Partition cowscript code into sub-blocks
    this.partitionCode(code);
    // Execute from __start
    this.runSub(block);
  }

  /**
   * Partitions the cowscript code by ## into subroutines
   */
  partitionCode(code) {
    // Clean carriage returns
    const cleanCode = code.replace(/\r/g, '').replace(/\n/g, ' ');

    // Split on ##
    // We prefix with ##__start: to catch the initial statements
    const blocks = ('##__start:' + cleanCode).split('##');
    for (const block of blocks) {
      if (!block.trim()) continue;
      const colonIndex = block.indexOf(':');
      if (colonIndex !== -1) {
        const subName = block.substring(0, colonIndex).trim();
        const subContent = block.substring(colonIndex + 1).trim();
        this.subs[subName] = subContent;
      }
    }
  }

  /**
   * Executes a subroutine block line-by-line (semicolon separated)
   */
  runSub(subName) {
    const subContent = this.subs[subName];
    if (!subContent) {
      return;
    }
    const statements = subContent.split(';');
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (!trimmedStatement) continue;
      this.executeStatement(trimmedStatement);
    }
  }

  /**
   * Executes a single statement
   */
  executeStatement(statement) {
    //console.log({ statement });
    const trimmed = statement.trim();
    if (!trimmed) return;

    const { firstword, rest } = this.splitFirstWord(trimmed);

    // Flexible handling for variable assignments without the "var" keyword
    // e.g. `$prefix to (sweetly, nicely)` -> rewritten as `var $prefix to ...`
    if (firstword.startsWith('$')) {
      rest = `${firstword} ${rest}`;
      firstword = 'var';
    }

    const handler = this.statementList[firstword.toLowerCase()];
    if (handler) {
      // Pass the remaining string
      handler(rest);
    } else {
      console.warn(`No handler found for statement keyword: "${firstword}"`);
    }
  }

  /**
   * Resolve a value: literal, $var, or $actor's loc's host's loc chain
   */
  resolveValue(token) {
    let t = token.trim();
    if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))) {
      if (t.includes('$')) {
        t = t.replace(/[$"']/g, '');
        return this.context[t];
      } else {
        return t.replace(/["']/g, '');
      }
    }
    if (!t.startsWith('$')) return t;

    const parts = t.split("'s ");
    const varName = parts[0].substring(1);
    let value = this.context[varName] ?? '';

    for (let i = 1; i < parts.length; i++) {
      const obj = this.app.db.getById(value);
      if (!obj) return '';
      value = obj[parts[i]] ?? '';
    }

    return value;
  }

  /**
   * Resolve a $var or chained expression (e.g. $target's link's host) to an object.
   * Returns the object, or null if the ID can't be resolved.
   * @param {string} token  - e.g. '$target' or "$target's link's host"
   * @returns {object|null}
   */
  resolveObj(token) {
    const id = this.resolveValue(token);
    if (!id) return null;
    return this.app.db.getById(id) || null;
  }

  /**
   * Parse a natural language object description into its components
   * e.g. "3 small black fluffy mice" → { qty, color, attribs, class, name }
   */
  parseObj(str) {
    const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black', 'white', 'grey', 'gray', 'brown', 'silver', 'gold'];
    const sizes = ['tiny', 'small', 'little', 'large', 'big', 'huge', 'giant', 'massive'];
    const words = str.trim().replace(/^["']|["']$/g, '').split(/\s+/);
    let qty = 1;
    let color = '', attribs = [], cls = '', name = '';
    let i = 0;
    if (/^\d+$/.test(words[0])) { qty = parseInt(words[i++]); }
    const articles = ['a', 'an', 'the', 'some'];
    if (articles.includes(words[i]?.toLowerCase())) i++;
    while (i < words.length) {
      const w = words[i].toLowerCase();
      if (!color && colors.includes(w)) { color = w; i++; }
      else if (sizes.includes(w)) { attribs.push(w); i++; }
      else { break; }
    }
    cls = words[i] || '';
    name = words.slice(i + 1).join(' ');
    return { qty, color, attribs: attribs.join(' '), class: cls, name };
  }


  // ------------------------------------------------------------------------------
  // all of the cowmands or statements of a block in cowscript
  statementList = {
    // GET handler
    /*
      get $target,$rel,$word,non-greedy in $loc;
      - non-greedy optional 4th param 
      - "force the mouse to jump on the cat" <- non-greedy (split on first 'to')
      - "whisper go to the open field to bob" <- greedy (default, split on last 'to')

      get $target,$rel,$second in $loc,$actor;
      - the double $loc,$loc allows finding $target in $loc and Second in $actor
      - second $loc is optional, defaults to $loc 
    */
    get: (rest) => {
      // --- Step 1: Extract and clean input ---
      let firstword = rest.trim();
      firstword = firstword.replace(/`/g, "'");

      // --- Step 2: Handle target history ---
      const ltarget = this.context.target || this.context.last_target || '';
      const lsecond = this.context.second || '';

      // --- Step 3: Identify search locations (the 'in' keyword) ---
      let getLocValue = 0;
      let getSecondLocValue = 0;

      const inMatch = firstword.match(/^(.+)\s+in\s+(.+)$/i);
      if (inMatch) {
        firstword = inMatch[1].trim();
        const locParts = inMatch[2].split(',', 2).map(s => s.trim());
        // Resolve each $loc variable
        getLocValue = this.resolveValue(locParts[0]);
        getSecondLocValue = locParts[1] ? this.resolveValue(locParts[1]) : getLocValue;
      } else {
        // Default to looking everywhere
        getLocValue = 'all';
        getSecondLocValue = getLocValue;
      }

      this.context.findTargetInLoc = getLocValue;
      this.context.findSecondInLoc = getSecondLocValue;

      // --- Step 4: Parse variable bits ---
      // Split by comma, but respect quoted strings like "as"
      const getBits = firstword.split(',').map(s => s.trim());
      const gCount = getBits.length;

      // --- Step 5: Check for non-greedy flag (4th param) ---
      let nonGreedy = false;
      if (gCount >= 4) {
        // Any text in the 4th position triggers non-greedy matching
        nonGreedy = true;
      }
      //console.log({ gCount }, getBits);

      // Helper: determine if a bit is a quoted literal (e.g., "as", "to")
      const isQuotedLiteral = (bit) => {
        return (bit.startsWith('"') && bit.endsWith('"')) ||
          (bit.startsWith("'") && bit.endsWith("'"));
      };

      // Helper: strip $ from variable name
      const varName = (bit) => bit.replace(/^\$/, '');

      // Helper: strip quotes from a literal
      const unquote = (bit) => bit.replace(/^["']|["']$/g, '');

      // --- Step 6: Map user input (cmd_text) into the variable slots ---
      const cmdText = this.context.cmd_text || '';

      if (gCount === 1) {
        // get $target  →  $target = cmd_text
        this.context[varName(getBits[0])] = cmdText;
        //console.log(`get`, varName(getBits[0]), getBits[0], this.context[varName(getBits[0])]);

      } else if (gCount === 2) {
        if (firstword.toLowerCase().includes('lastword')) {
          // get $target,$lastword → split on LAST space: "color the cat blue" → "color the cat" + "blue"
          const lastSpaceIdx = cmdText.lastIndexOf(' ');
          if (lastSpaceIdx !== -1) {
            this.context[varName(getBits[0])] = cmdText.substring(0, lastSpaceIdx);
            this.context[varName(getBits[1])] = cmdText.substring(lastSpaceIdx + 1);
          } else {
            this.context[varName(getBits[0])] = cmdText;
            this.context[varName(getBits[1])] = '';
          }
        } else {
          // get $firstword,$target → split on FIRST space: "go towards the cat" → "go" + "towards the cat"
          const firstSpaceIdx = cmdText.indexOf(' ');
          if (firstSpaceIdx !== -1) {
            this.context[varName(getBits[0])] = cmdText.substring(0, firstSpaceIdx);
            this.context[varName(getBits[1])] = cmdText.substring(firstSpaceIdx + 1);
          } else {
            this.context[varName(getBits[0])] = cmdText;
            this.context[varName(getBits[1])] = '';
          }
        }
        //console.log(`get2`, varName(getBits[0]), getBits[0], this.context[varName(getBits[0])]);
        //console.log(`get2`, varName(getBits[1]), getBits[1], this.context[varName(getBits[1])]);

      } else if (gCount >= 3) {
        // 3 or 4 variables: split cmd_text on relationship word
        // The rel word is either a quoted literal (e.g., "as") or dynamic ($rel_words)
        let relWords;
        if (isQuotedLiteral(getBits[1])) {
          // Quoted literal: use exactly that word as the splitter
          relWords = unquote(getBits[1]);
        } else {
          // Dynamic: use standard relationship words
          relWords = this.relWords; //'to|on|in|at|under|towards|from|with|into|as';
        }

        let splitMatch;
        if (nonGreedy) {
          // Non-greedy: split on FIRST occurrence of rel word
          const relRegex = new RegExp(`^(.*?)\\s+(${relWords})\\s+(.*)$`, 'i');
          splitMatch = cmdText.match(relRegex);
        } else {
          // Greedy (default): split on LAST occurrence of rel word
          const relRegex = new RegExp(`^(.+)\\s+(${relWords})\\s+(.*)$`, 'i');
          splitMatch = cmdText.match(relRegex);
        }

        if (splitMatch) {
          const part1 = splitMatch[1].trim();
          const relPart = splitMatch[2].trim();
          const part3 = splitMatch[3].trim();

          // Store the raw matched text into context vars
          this.context[varName(getBits[0])] = part1;
          this.context[varName(getBits[1])] = relPart;
          this.context[varName(getBits[2])] = part3;
          //console.log(splitMatch, this.context);
        } else {
          // No rel word found — put everything in the first variable
          this.context[varName(getBits[0])] = cmdText;
          this.context[varName(getBits[1])] = '';
          this.context[varName(getBits[2])] = '';
        }
        //console.log(`get3`, varName(getBits[0]), getBits[0], this.context[varName(getBits[0])]);
        //console.log(`get3`, varName(getBits[1]), getBits[1], this.context[varName(getBits[1])]);
        //console.log(`get3`, varName(getBits[2]), getBits[2], this.context[varName(getBits[2])]);
      }

      // treat 'it' and 'them' as the last target — resolve BEFORE object lookup below
      if (['it', 'them'].includes((this.context.target || '').toLowerCase())) {
        this.context.target = this.context.lastt;
      }
      if (['it', 'them'].includes((this.context.second || '').toLowerCase())) {
        this.context.second = this.context.lastt;
      }
      //console.log(this.context);

      // --- Step 7: Resolve objects (like perl's get_resolve) ---
      // Save the raw text values, then resolve named objects to IDs
      const ntarget = this.context.target;
      const nsecond = this.context.second;

      // Restore previous target/second before resolving
      this.context.target = ltarget;
      this.context.second = lsecond;

      // Helper: returns true if the value is already a known object ID (skip name lookup)
      const isAlreadyId = (val) => !!this.app.db.getById(val);

      // Resolve: if the variable is 'target' or 'second', look up the object ID
      if (ntarget) {
        if (isAlreadyId(ntarget)) {
          // Already an ID (e.g. resolved from 'it') — use directly
          this.context.target = ntarget;
        } else {
          const resolved = this.app.db.findByNameInLoc(ntarget, getLocValue);
          this.context.target = resolved || ntarget; // keep raw text if no object found
        }
      }
      if (nsecond) {
        if (isAlreadyId(nsecond)) {
          this.context.second = nsecond;
        } else {
          const resolved = this.app.db.findByNameInLoc(nsecond, getSecondLocValue);
          this.context.second = resolved || nsecond; // keep raw text if no object found
        }
      }
      //console.log('final', this.context);
    },

    // IF/THEN/ELSE handler
    if: (rest) => {
      let match = rest.match(/^(.+?)\s+(equals|is|like|in|eq|ne|>|<|!=|>=|<=|=|==)\s+(.+?)\s+then\s+(.+)$/i);
      if (!match) return;

      const op1Raw = match[1].trim();
      const operator = match[2].toLowerCase();
      const op2Raw = match[3].trim();
      const actionsPart = match[4].trim();

      const val1 = this.resolveValue(op1Raw);
      const val2 = this.resolveValue(op2Raw);

      let conditionMet = false;
      if (['>', '<', '>=', '<='].includes(operator)) {
        const num1 = parseFloat(val1) || 0;
        const num2 = parseFloat(val2) || 0;
        if (operator === '>') conditionMet = num1 > num2;
        if (operator === '<') conditionMet = num1 < num2;
        if (operator === '>=') conditionMet = num1 >= num2;
        if (operator === '<=') conditionMet = num1 <= num2;
      } else if (operator === 'like') {
        const cleanVal2 = val2.toString().replace(/^['"]|['"]$/g, '');
        conditionMet = val1.toString().toLowerCase().includes(cleanVal2.toLowerCase());
      } else {
        const eq = (val1.toString() === val2.toString());
        conditionMet = (operator === 'ne' || operator === '!=') ? !eq : eq;
      }

      const elseIndex = actionsPart.indexOf(' else ');
      let thenSub, elseSub;
      if (elseIndex !== -1) {
        thenSub = actionsPart.substring(0, elseIndex).trim();
        elseSub = actionsPart.substring(elseIndex + 6).trim();
      } else {
        thenSub = actionsPart;
        elseSub = '';
      }

      if (conditionMet) {
        if (thenSub) this.runSub(thenSub);
      } else {
        if (elseSub) this.runSub(elseSub);
      }
    },

    // VAR handler
    var: (rest) => {
      const cleanRest = rest.replace(/^var\s+/i, '');
      let match = cleanRest.match(/^(\$\w+)\s+(?:to|=)\s+(.+)$/i);
      if (!match) return;

      const varName = match[1].substring(1);
      const rawVal = match[2].trim();

      if (rawVal.startsWith('(') && rawVal.endsWith(')')) {
        const choices = rawVal.substring(1, rawVal.length - 1).split(',').map(s => s.trim());
        const selected = choices[Math.floor(Math.random() * choices.length)];
        this.context[varName] = selected;
      } else {
        this.context[varName] = this.resolveValue(rawVal);
      }
      //console.log(`var`, varName, rawVal, this.context[varName]);
    },

    /*
    "put the cat on the box"

    get $target,$rel,$second in $loc,$loc;

    $target="the cat on the box"

    $target's host to $second
    $target's hosthow to \"$rel\"
    $target's pose to ''

    let match = rest.match(/^(\$\w+)\s+'s\s+(\w+)\s+(?:to|=)\s+(.+)$/i);

    */

    // SET handler - set object properties
    set: (rest) => {
      // Match: $target's host to $second or $target's hosthow to "value"
      // match[1] = $var or chained $var's prop's prop, match[2] = prop, match[3] = value
      let match = rest.match(/^(\$[\w'\s]+)\s*'s\s+(\w+)\s+(?:to|=)\s+(.+)$/i);
      if (!match) return;

      const obj = this.resolveObj(match[1].trim());
      if (!obj) return;

      const prop = match[2].toLowerCase();           // host, hosthow, pose, etc.
      const val = this.resolveValue(match[3].trim()); // handles $vars and quoted strings
      const oldObj = { ...obj };
      obj[prop] = val;

      // Save the updated object
      this.app.db.save(obj, oldObj);
    },

    // eg: update $new_id to "worth=0, link=$exit, material='_door_', color='lightgreen'"
    update: (rest) => {
      // match[1] = $var or chained expression, match[2] = key=val pairs
      const match = rest.match(/^(\$[\w'\s]+)\s+(?:to|=)\s+["']?(.+?)["']?$/i);
      if (!match) return;

      const obj = this.resolveObj(match[1].trim());
      if (!obj) return;

      const oldObj = { ...obj };
      for (const pair of match[2].split(',')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const prop = pair.substring(0, eqIdx).trim();
        const val = this.resolveValue(pair.substring(eqIdx + 1).trim());
        obj[prop] = val;
      }

      this.app.db.save(obj, oldObj);
    },

    clear: (rest) => {
      // match[1] = $var or chained expression, match[2] = params
      const match = rest.match(/^(.+)\s*,\s*(.+)$/i);
      if (!match) return;

      const obj = this.resolveObj(match[1].trim());
      if (!obj) return;
      const oldObj = { ...obj };

      const params = match[2];
      // TODO: if params == 'xyz' we only clear those
      delete obj.host;
      delete obj.hosthow;
      delete obj.pose;
      // TODO: clear the x, y and z and maybe other positional things

      // Save the updated object
      this.app.db.save(obj, oldObj);
    },

    // SAY handler
    say: (rest) => {
      const match = rest.match(/^['"](\w+)['"]\s*,\s*(.+)$/i);
      if (!match) return;
      // include the trigger word 'say' or 'ask' into the context so we can find which objects react to it
      this.context.trigger = (match[1]);

      let msg = this.app.utils.trimQuotes(match[2].trim());

      this.app.messageManager.add({
        msg,
        brief: true,
        objs: this.objs,
        context: { ...this.context }
      });
    },

    relook: (rest) => {
      const loc = this.resolveValue(rest.trim());
      this.context.loc = loc;
      const data = this.app.db.lookLoc({ ...this.context });
      this.app.messageManager.add(data);
    },

    
    list: (rest) => {
      const loc = this.resolveValue(rest.trim());
      this.context.loc = loc;
      const data = this.app.db.listLoc({ ...this.context });
      this.app.messageManager.add(data);

    },


    new: (rest) => {
      const parsed = this.parseObj(this.resolveValue(rest.trim()));
      const db = this.app.db;
      const loc = this.context.loc;
      // find existing object with same class+name in this loc to stack onto
      // let existing = null;
      // for (const [id, obj] of om.pool) {
      //   if (obj.loc === loc && obj.class === parsed.class && obj.name === parsed.name) {
      //     existing = obj; break;
      //   }
      // }
      // if (existing) {
      //   existing.qty = (existing.qty || 1) + parsed.qty;
      //   om.save(existing);
      //   this.context.target = existing.id;
      // } else {
      //   const obj = { loc, ...parsed };
      //   om.save(obj);
      //   this.context.target = obj.id;
      // }

      // quick and simple object creator
      const obj = { loc, ...parsed };
      obj.id = this.app.id.new();
      db.addToPools(obj);
      this.context.target = obj.id;   // set target to the new object's ID
      this.context.lastt = obj.id;    // update lastt so 'it' works in follow-up commands
      this.context.new_id = obj.id;
    },

    runsub: (rest) => {
      this.runSub(rest);
    },

    msg: (rest) => {
      console.log(`msg`);
      // if($this_cmd =~ m/^msg (.+)/i){
      // &add_msg(eval($1)); # $loc,$actor,$target,$second,$action,$msg,$init_obj,$init_cmd


    },

    flush: ($rest) => {
      this.app.db.flush();
    },

    unhost: (rest) => {
      // unhost everything hosted by this object.
      // Supports simple vars ($target) and chained expressions ($target's link's host)
      const obj = this.resolveObj(rest.trim());
      if (!obj) return;
      const hosted = this.app.db.findInLoc(obj.id);
      for (const subId of hosted) {
        const sub = this.app.db.getById(subId);
        if (!sub) continue;
        const oldObj = { ...sub };
        sub.host = '';
        sub.hosthow = '';
        sub.pose = '';
        this.app.db.save(sub, oldObj);
      }
    },

    relocate: (rest) => {
      console.log('relocate, all-in-one move update and msg');
    },

    add: (rest) => { console.log(`add`) },
    call: (rest) => { console.log(`call`) },
    case: (rest) => { console.log(`case`) },
    code: (rest) => { console.log(`code`) },
    copy: (rest) => { console.log(`copy`) },
    dedup: (rest) => { console.log(`dedup`) },
    divide: (rest) => { console.log(`divide`) },
    find: (rest) => { console.log(`find`) },
    fixplural: (rest) => { console.log(`fixplural`) },
    foreach: (rest) => { console.log(`foreach`) },
    getname: (rest) => { console.log(`getname`) },
    goto: (rest) => { console.log(`goto`) },
    include: (rest) => { console.log(`include`) },
    load: (rest) => { console.log(`load`) },
    loop: (rest) => { console.log(`loop`) },
    mode: (rest) => { console.log(`mode`) },
    motion: (rest) => { console.log(`motion`) },
    multiply: (rest) => { console.log(`multiply`) },
    nudge: (rest) => { console.log(`nudge`) },
    percentbar: (rest) => { console.log(`percentbar`) },
    refresh: (rest) => { console.log(`refresh`) },
    save: (rest) => { console.log(`save`) },
    swap: (rest) => { console.log(`swap`) },
    take: (rest) => { console.log(`take`) },
  };


  /**
   * Find the objects in the data.context.loc that react to this trigger word
   * loop through each and see if they are triggered in this context
   * @param {object} data 
   */
  reactions(data) {
    // eg 'ask', there is a robot in your location that "has statement "if taget of 'say' then answer;
    this.app.db.findTrigger(data.context);

  }
}
