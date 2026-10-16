import './bcrypt.js';
let bcrypt = globalThis.bcrypt;
if (!bcrypt && typeof process !== 'undefined' && typeof window === 'undefined') {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    bcrypt = require('./bcrypt.js');
  } catch (e) {}
}

// Handles current player info, logging in, updating storage, command history
export class Player {
  id = '';
  name = '';
  loc = '';
  it = '';
  editing = false;
  history = [];
  remember = true;
  startingLocation = '_2';
  isBot = false;

  constructor(app) {
    this.app = app;
    this.checkBot();
  }

  /**
   * If the url references an obj by ID then this is a bot and we read the initial object.
   * wolispace.com/cowdee?_wol_slug = '?_wol_slug' = '_wol' as the ID and ignoe everything else
   * @returns {boolean}
   */
  checkBot() {
    if (!this.app.window) return;
    const params = window.location.search.split('_');
    if (params.length < 2) return false;
    // what is the bot reading? 
    this.botTarget = `_${params[1]}`;
    this.isBot = true;
  }
  
  /** 
   * Show the logon form 
   */
  async welcome() {
    if (!this.app.window) return;
    if (this.isBot) {
       // send cmd to make a new bunny
        await this.sendWakeCmd();
        return;
    }
    // TODO: pass focus element as 2nd paran
    this.app.ui.showDialog(this.findPlayerFormContent());
    document.getElementById('playername')?.focus();
  }


  findPlayerFormContent() {
    const defaultName = this.app.local ? 'Wolis' : '';
    return `
      <form method="dialog" id="loginform">
        <input type="hidden" name="type" value="login">
        <label for="playername">Who are you?</label>
        <input type="text" id="playername" name="playername" 
          placeholder="Your name in cow" value="${defaultName}" 
          required
          autofocus 
          spellcheck="false"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
        />
        <label class="remember-row" style="display: flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; font-size: 0.9em; user-select: none;">
          <input type="checkbox" id="remember" name="remember" value="1" ${this.remember ? 'checked' : ''} />
          Remember me
        </label>
        <menu>
          <button value="submit" class="buttonize">Login</button>
        </menu>
      </form>
    `;
  }

  checkPwContent() {
    return `
      <form method="dialog" id="loginform">
        <input type="hidden" name="type" value="checkpw">
        <input type="hidden" name="remember" value="${this.remember ? '1' : '0'}">
        Welcome back ${this.name}
        <label for="pw">What is your password?</label>
        <input type="text" id="pw" name="pw" placeholder="Prove you are you"
          required
          autofocus 
          spellcheck="false"
          inputmode="password"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
        />
        <menu>
          <button value="submit" class="buttonize">Continue</button>
        </menu>
      </form>
    `;
  }

  newPlayerContent() {
    return `
      <form method="dialog" id="loginform">
        <input type="hidden" name="type" value="newplayer">
        <input type="hidden" name="remember" value="${this.remember ? '1' : '0'}">
        Welcome new player ${this.name}.
        <label for="pw">Set your new password:</label>
        <input type="text" id="pw" name="pw" placeholder="So you can prove you are you"
          required
          autofocus 
          spellcheck="false"
          inputmode="password"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"        
        />
        <menu>
          <button value="submit" class="buttonize">Continue</button>
        </menu>
      </form>
    `;
  }

  /**
   * Takes login form data (playername and remember)
   * Find that player. If found check pw else treat as a new player 
   * @param {object} data 
   */
  async handleFindPlayer(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    const obj = await this.app.db.findPlayer(data);

    console.log(`${this.app.name} handleFindPlayer found `, obj);
    if (obj) {
      this.name = obj.name;
      this.id = obj.id;
      if (!this.app.window || (this.app.local && this.app.quickLogin)) {
        await this.logon(obj);
      } else {
        this.app.ui.showDialog(this.checkPwContent());
        document.getElementById('pw')?.focus();
      }
    } else {
      this.name = data.playername;
      if (this.app.window) {
        this.app.ui.showDialog(this.newPlayerContent());
        document.getElementById('pw')?.focus();
      }
    }
  }

  /**
   * Take the password entry form and do something with its values
   * @param {object} data 
   */
  async handleCheckPw(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    const objPw = await this.app.db.getPw(this.id);
    const obj = await this.app.db.getById(this.id);

    if (obj && objPw) {
      const pwOk = await bcrypt.compare(data.pw, objPw);
      console.log(`${this.app.name} password ${data.pw} is ${pwOk}`);
      if (pwOk) {
        await this.logon(obj);
      } else {
        this.app.ui.alert(`Hmm... that didn't match. Try again`);
      }
    } else {
      this.app.ui.alert(`${this.name} id=${this.id} can't be found`);
    }
  }

  /**
   * Take the form with the new players password, save it for later then wake the new player
   * @param {object} data 
   */
  async handleNewPlayer(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    this.pendingPw = await bcrypt.hash(data.pw, 10);
    this.loc = '_2';
    this.app.ui.closeDialog();
    await this.sendWakeCmd();
  }

  /**
   * Takes a name like 'player-bob-_2' and make a new object, returning the new object id
   * This could be a new plater or a new bot
   * @param {string} name 
   * @returns {string}
   */
  async newPlayer(name) {
    // split name on _. eg 'player-bob-_2' or 'bunny-_5-_2'
    const parts = name.split('-');

    const newId = this.app.id.new();
    const obj = { 
      id: newId,
      loc: parts[2] ?? this.startingLocation, 
    };
    
    if (parts[0] === 'player') {
      obj.class = 'player';
      obj.name = parts[1] ?? 'Unnamed';
      obj.loc = parts[2] ?? this.startingLocation;
      obj.owner = newId;
      obj.color = 'gold';
      // is this the player who sent the context to create a new player?
      if (this.pendingPw) {
        obj.pw = this.pendingPw;
        delete this.pendingPw;
      }
    } else {
      obj.class = 'bunny';
      obj.color = 'tan';
      // remember the second param as the object the bot is reading
      this.botTarget = parts[1];
    }

    await this.app.db.save(obj);

    // if this browser has not current player it becomes this player
    if (this.id === '') {
      this.id = obj.id;
      this.loc = obj.loc;
      this.app.name = obj.id;
      if (this.remember) {
        this.app.storage?.setItem('rememberedPlayer', this.id);
      }
      this.save();
    }
    return obj.id;
  }

  /**
   * Finalise login of player, saving into storage and waking up
   * @param {object} obj
   */
  async logon(obj) {
    this.id = obj.id;
    this.loc = obj.loc;
    this.name = obj.name;
    this.app.name = obj.id;

    // Restore any previously stored history for this player
    this.loadHistory();

    if (this.remember) {
      this.app.storage?.setItem('rememberedPlayer', this.id);
    } else {
      this.app.storage?.removeItem('rememberedPlayer');
    }
    this.save();
    console.log(`${this.app.name} logs in`);
    await this.sendWakeCmd();
  }

  // Clear player and show welcome login dialog
  async logoff() {
    this.clear();
    await this.welcome();
  }

  /**
   * Sends a wake context with sufficient info in the name to re-build the new object when the context is processed
   * 'class-name-loc' or 'class-botTarget-loc' eg: 'player-bob-_2' or 'bunny-_5-_2'
   */
  async sendWakeCmd() {
    const result = await this.app.io.fetchJson('server', { 'lastContext': 1 });
    this.app.lastContext = result?.lastContext || '0';


    const params = { 
      cmd: 'wake', 
      actor: this.id, 
      loc: this.loc, 
      saveHistory: false,
    };

    // the name is 'class-name-loc' eg 'player-bob-_2'
    if (!this.id) {
      params.loc = this.startingLocation;      
      if (this.isBot) {
        const target = await this.app.db.getById(this.botTarget);
        params.loc = target.loc;
        params.actor = `bunny-${target.id}-${params.loc}`;
      } else {
        params.actor = `player-${this.name}-${params.loc}`;
      }
    }
    await this.app.sendCommand(params);
  }

  /**
   * The player objects now exists and its attached to this.player 
   * so wake them by looking around or if its a bot, read the botTarget object
   */
  async wakePlayer() {
    console.log(`${this.app.name} wakePlayer:`, this.name, this.id, this.loc);
    // if this is a bot, then the new command is 'read'
    if (this.botTarget) {
      await this.app.sendCommand({ cmd: `read ${this.botTarget}`, actor: this.id, loc: this.loc, saveHistory: false });
    } else {
      await this.app.sendCommand({ cmd: 'look', actor: this.id, loc: this.loc, saveHistory: false });
    }
  }

  /**
   * Silently refresh what the player is seeing without anoucing they look around (do this after editing and returning to a tab etc..)
   */
  async relook() {
        console.log(`${this.name} silent relook just this player ${this.id} in ${this.loc}...`);
    const data = await this.app.lookManager.look({ actor: this.id, loc: this.loc, trigger: 'relook' });
    await this.app.ui.addMessage(data);
  }

  /**
   * Load remembered player and history from storage when browser opens
   */
  async load() {
    const rememberedId = this.app.storage?.getItem('rememberedPlayer');
    if (rememberedId) {
      const obj = await this.app.db.getById(rememberedId);
      if (obj) {
        this.remember = true;
        await this.logon(obj);
        return;
      }
    }
    this.history = [];
    await this.welcome();
  }

  /**
   * Restore history from player-specific storage entry
   */
  loadHistory() {
    if (!this.id) return;
    const json = this.app.storage?.getItem(`player_${this.id}`);
    if (json) {
      try {
        const stored = JSON.parse(json);
        if (Array.isArray(stored.history)) {
          this.history = stored.history;
        }
      } catch (e) {}
    }
  }

  /**
   * Saves player persistent details (id, name, loc, history)
   */
  save() {
    if (!this.id) return;
    const data = {
      id: this.id,
      name: this.name,
      loc: this.loc,
      history: this.history
    };
    this.app.storage?.setItem(`player_${this.id}`, JSON.stringify(data));
  }

  addHistory(cmd) {
    if (!cmd || typeof cmd !== 'string') return;
    cmd = cmd.trim();
    if (!cmd) return;
    if (!Array.isArray(this.history)) {
      this.history = [];
    }
    const existingIndex = this.history.indexOf(cmd);
    if (existingIndex !== -1) {
      this.history.splice(existingIndex, 1);
    }
    this.history.push(cmd);
    if (this.history.length > 50) {
      this.history.shift();
    }
    this.save();
  }

  clear() {
    this.app.storage?.removeItem('rememberedPlayer');
    this.id = '';
    this.name = '';
    this.loc = '';
    this.it = '';
    this.editing = false;
    this.history = [];
    this.remember = false;
    this.pendingPw = null;
  }
}
