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

  constructor(app) {
    this.app = app;
  }

  /** 
   * Show the logon form 
   */
  async welcome() {
    if (!this.app.window) return;
    if (this.isBot()) {
        const obj = await this.newBot();
        return;
    }
    // TODO: pass focus element as 2nd paran
    this.app.ui.showDialog(this.findPlayerFormContent());
    document.getElementById('playername')?.focus();
  }

  /**
   * If the url references an obj by ID then this is a bot and we read the initial object.
   * wolispace.com/cowdee?_wol_slug = '?_wol_slug' = '_wol' as the ID and ignoe everything else
   * @returns {boolean}
   */
  isBot() {
    const params = window.location.search.split('_');
    if (params.length < 2) return false;
    this.initObj = `_${params[1]}`;
    return true;
  }

  /**
   * Create a new object that is a bot so saving saves it into the bot__.json index
   */
  async newBot() {
    // TODO: change to use context 'wake' to make new player
    this.remember = false;
    const botName = 'bunny';
    const target = await this.app.db.getById(this.initObj);
    this.loc = target.loc;
    this.id = this.app.id.new();
    this.name = botName;
    const obj = {
      id: this.id,
      class: botName,
      loc: this.loc,
      color: 'wheat',
      bot: true,
    };
    await this.app.db.save(obj);
    console.log(`${this.app.name} bot logs in`);
    await this.wake();
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

  _newPlayerResolve = null;

  async waitForId() {
    if (this.id) return;
    return new Promise(resolve => {
      this._newPlayerResolve = resolve;
      setTimeout(() => resolve(), 3000);
    });
  }

  async handleNewPlayer(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    this.pendingPw = await bcrypt.hash(data.pw, 10);
    this.loc = '_2';
    await this.wake();
  }

  async newPlayer(name) {
    const startingLocation = '_2';
    const newId = this.app.id.new();
    const obj = {
      id: newId,
      class: 'player',
      name: name,
      loc: startingLocation,
      lock: 1,
      owner: newId,
      color: 'gold'
    };
    if (this.pendingPw && this.name === name) {
      obj.pw = this.pendingPw;
      delete this.pendingPw;
    }
    await this.app.db.save(obj);

    if (!this.id && this.name === name) {
      this.id = obj.id;
      this.loc = obj.loc;
      this.app.name = obj.id;
      this.loadHistory();
      if (this.remember) {
        this.app.storage?.setItem('rememberedPlayer', this.id);
      } else {
        this.app.storage?.removeItem('rememberedPlayer');
      }
      this.save();
      console.log(`${this.app.name} new player created and logged in`);
      if (this._newPlayerResolve) {
        this._newPlayerResolve();
        this._newPlayerResolve = null;
      }
    }
    return obj;
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
    await this.wake();
  }

  // Clear player and show welcome login dialog
  async logoff() {
    this.clear();
    await this.welcome();
  }

  async wake() {
    const result = await this.app.io.fetchJson('server', { 'lastContext': 1 });
    console.log(` ${this.app.name} wake `, result);
    this.app.lastContext = result?.lastContext || '0';
    // TODO: bots need to wake a new bot player without password
    // need to use same sendCmd to wake but not check qw, and run a 'read'
    if (this.bot) {
      await this.app.sendCommand({ cmd: `examine ${this.initObj}`, actor: this.id, loc: this.loc, saveHistory: false });
    } else {
      await this.app.sendCommand({ cmd: 'wake', actor: this.id || this.name, loc: this.loc || '_2', saveHistory: false });
      if (!this.id) {
        await this.waitForId();
      }
      await this.app.sendCommand({ cmd: 'look', actor: this.id, loc: this.loc || '_2', saveHistory: false });
    }
    this.app.ui.closeDialog();
  }

  async wakePlayer(actor) {
    console.log(`${this.app.name} wakePlayer:`, actor);
    return await this.newPlayer(actor);
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
    this._newPlayerResolve = null;
  }
}
