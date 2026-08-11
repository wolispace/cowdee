// Cowmands.js – modular command handling
export class Cowmands {
  /**
   * Create a Cowmands helper. Pass the main app instance so handlers can access DB, utils, etc.
   */
  constructor(app, context) {
    this.app = app;
    this.context = context;
  }

  // Statement handlers – copied from CommandManager.statementList
  statementList = {
    // GET handler – identical to CommandManager's implementation
    // get is different from other cowmands as it sets up the context, other commands manipluate the context.
    get: (rest) => {
      // --- Step 1: Extract and clean input ---
      let firstword = rest.trim();
      firstword = firstword.replace(/`/g, "'");
      // --- Step 2: Handle target history ---
      const ltarget = this.context?.target || this.context?.last_target || '';
      const lsecond = this.context?.second || '';
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
      const getBits = firstword.split(',').map(s => s.trim());
      const gCount = getBits.length;
      // --- Step 5: Check for non‑greedy flag (4th param) ---
      let nonGreedy = false;
      if (gCount >= 4) {
        nonGreedy = true;
      }
      // Helper: determine if a bit is a quoted literal (e.g., "as", "to")
      const isQuotedLiteral = (bit) => {
        return (bit.startsWith('"') && bit.endsWith('"')) || (bit.startsWith("'") && bit.endsWith("'"));
      };
      // Helper: strip $ from variable name
      const varName = (bit) => bit.replace(/^\$/, '');
      // Helper: strip quotes from a literal
      const unquote = (bit) => bit.replace(/^["']|["']$/g, '');
      // --- Step 6: Map user input (cmd_text) into the variable slots ---
      const cmdText = this.context.cmd_text || '';
      if (gCount === 1) {
        this.context[varName(getBits[0])] = cmdText;
      } else if (gCount === 2) {
        if (firstword.toLowerCase().includes('lastword')) {
          const lastSpaceIdx = cmdText.lastIndexOf(' ');
          if (lastSpaceIdx !== -1) {
            this.context[varName(getBits[0])] = cmdText.substring(0, lastSpaceIdx);
            this.context[varName(getBits[1])] = cmdText.substring(lastSpaceIdx + 1);
          } else {
            this.context[varName(getBits[0])] = cmdText;
            this.context[varName(getBits[1])] = '';
          }
        } else {
          const firstSpaceIdx = cmdText.indexOf(' ');
          if (firstSpaceIdx !== -1) {
            this.context[varName(getBits[0])] = cmdText.substring(0, firstSpaceIdx);
            this.context[varName(getBits[1])] = cmdText.substring(firstSpaceIdx + 1);
          } else {
            this.context[varName(getBits[0])] = cmdText;
            this.context[varName(getBits[1])] = '';
          }
        }
      } else if (gCount >= 3) {
        // 3 or more variables: split cmd_text on relationship word
        let relWords;
        if (isQuotedLiteral(getBits[1])) {
          relWords = unquote(getBits[1]);
        } else {
          relWords = this.relWords;
        }
        let splitMatch;
        if (nonGreedy) {
          const relRegex = new RegExp(`^(.*?)\\s+(${relWords})\\s+(.*)$`, 'i');
          splitMatch = cmdText.match(relRegex);
        } else {
          const relRegex = new RegExp(`^(.+)\\s+(${relWords})\\s+(.*)$`, 'i');
          splitMatch = cmdText.match(relRegex);
        }
        if (splitMatch) {
          const part1 = splitMatch[1].trim();
          const relPart = splitMatch[2].trim();
          const part3 = splitMatch[3].trim();
          this.context[varName(getBits[0])] = part1;
          this.context[varName(getBits[1])] = relPart;
          this.context[varName(getBits[2])] = part3;
        } else {
          this.context[varName(getBits[0])] = cmdText;
          this.context[varName(getBits[1])] = '';
          this.context[varName(getBits[2])] = '';
        }
      }
      // Resolve pronouns
      if (['it', 'them'].includes((this.context.target || '').toLowerCase())) {
        this.context.target = this.context.lastt;
      }
      if (['it', 'them'].includes((this.context.second || '').toLowerCase())) {
        this.context.second = this.context.lastt;
      }
      // --- Step 7: Resolve objects (like perl's get_resolve) ---
      const ntarget = this.context.target;
      const nsecond = this.context.second;
      // Restore previous target/second before resolving
      this.context.target = ltarget;
      this.context.second = lsecond;
      const isAlreadyId = (val) => !!this.app.db.getById(val);
      if (ntarget) {
        if (isAlreadyId(ntarget)) {
          this.context.target = ntarget;
        } else {
          const resolved = this.app.db.findByNameInLoc(ntarget, getLocValue);
          this.context.target = resolved || ntarget;
        }
      }
      if (nsecond) {
        if (isAlreadyId(nsecond)) {
          this.context.second = nsecond;
        } else {
          const resolved = this.app.db.findByNameInLoc(nsecond, getSecondLocValue);
          this.context.second = resolved || nsecond;
        }
      }
    },
    // IF/THEN/ELSE handler (copied verbatim)
    if: (rest) => {
      let match = rest.match(/^(.+?)\s+(equals|is|like|in|eq|ne|>||<|!=|>=|<=|=|==)\s+(.+?)\s+then\s+(.+)$/i);
      if (!match) return;
      const op1Raw = match[1].trim();
      const operator = match[2].toLowerCase();
      const op2Raw = match[3].trim();
      const actionsPart = match[4].trim();
      const val1 = this.resolveValue(op1Raw);
      const val2 = this.resolveValue(op2Raw);
      let conditionMet = false;
      if ([ '>', '<', '>=', '<=' ].includes(operator)) {
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
    },
    // SET handler
    set: (rest) => {
      let match = rest.match(/^(\$[\w'\s]+)\s*'s\s+(\w+)\s+(?:to|=)\s+(.+)$/i);
      if (!match) return;
      const obj = this.resolveObj(match[1].trim());
      if (!obj) return;
      const prop = match[2].toLowerCase();
      const val = this.resolveValue(match[3].trim());
      const oldObj = { ...obj };
      obj[prop] = val;
      this.app.db.save(obj, oldObj);
    },
    // UPDATE handler
    update: (rest) => {
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
    // SAY handler
    say: (rest) => {
      const match = rest.match(/^['"](\w+)['"]\s*,\s*(.+)$/i);
      if (!match) return;
      this.context.trigger = match[1];
      this.context.msg = this.app.utils.trimQuotes(match[2].trim());
      this.app.ui.addMessage(this.context);
    },
    // Additional handlers (new, runsub, etc.) can be added here as needed.
    new: (rest) => {
      const parsed = this.parseObj(this.resolveValue(rest.trim()));
      const db = this.app.db;
      const loc = this.context.loc;
      const obj = { loc, ...parsed };
      obj.id = this.app.id.new();
      db.save(obj);
      this.context.target = obj.id;
      this.context.lastt = obj.id;
      this.context.new_id = obj.id;
    },
    runsub: (rest) => {
      this.runSub(rest);
    }
    // ... other handlers can be added similarly ...
  };
  // Helper methods needed for handlers – these delegate to the original CommandManager implementations
  resolveValue(token) {
    return CommandManager.prototype.resolveValue.call(this, token);
  }
  resolveObj(token) {
    return CommandManager.prototype.resolveObj.call(this, token);
  }
  parseObj(str) {
    return CommandManager.prototype.parseObj.call(this, str);
  }
  runSub(sub) {
    return CommandManager.prototype.runSub.call(this, sub);
  }
}