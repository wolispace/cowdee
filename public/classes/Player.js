import './bcrypt.js';
const bcrypt = globalThis.bcrypt;

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

  // Compatibility getters/setters for legacy code
  get playername() {
    return this.name;
  }
  set playername(val) {
    this.name = val;
  }

  get info() {
    return this;
  }
  set info(val) {
    if (val && typeof val === 'object') {
      if (val.id !== undefined) this.id = val.id;
      if (val.name !== undefined) this.name = val.name;
      if (val.playername !== undefined) this.name = val.playername;
      if (val.loc !== undefined) this.loc = val.loc;
      if (val.it !== undefined) this.it = val.it;
      if (val.editing !== undefined) this.editing = val.editing;
      if (val.history !== undefined) this.history = val.history;
    }
  }

  /** 
   * Show the logon form 
   */
  async welcome() {
    if (!this.app.window) return;
    this.app.ui.showDialog(this.loginFormContent());
    document.getElementById('playername')?.focus();
  }

  loginFormContent() {
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

  async handleLogon(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    const obj = await this.app.db.findPlayer(data);

    console.log(`${this.app.name} logon `, obj);
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
      this.app.ui.showDialog(this.newPlayerContent());
      document.getElementById('pw')?.focus();
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

  async handleNewPlayer(data) {
    if (data?.remember !== undefined) {
      this.remember = Boolean(data.remember === '1' || data.remember === true);
    }
    const hash = await bcrypt.hash(data.pw, 10);
    const startingLocation = '_2';
    const newId = this.app.id.new();
    const obj = {
      id: newId,
      class: 'player',
      name: this.name,
      loc: startingLocation,
      lock: 1,
      owner: newId,
      color: 'gold',
      pw: hash
    };
    await this.app.db.save(obj);
    await this.logon(obj);
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
    await this.app.sendCommand({ cmd: 'look', actor: this.id, loc: this.loc, saveHistory: false });
    this.app.ui.closeDialog();
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
  }
}
