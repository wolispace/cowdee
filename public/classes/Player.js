import './bcrypt.js';
const bcrypt = globalThis.bcrypt;
console.log(bcrypt);


// handles current player info, logging in, updating local storage
export class Player {

  info = { id: '', loc: '', history: [] };
  PLAYER_INFO_KEY = 'playerInfo';

  constructor(app) {
    this.app = app;
    this.load();
  }

  /** 
   * show the logon form 
   */
  async welcome() {
    if (!this.app.window) return;
    // show dialog, app.handleForm() handles logins
    this.app.ui.showDialog(this.loginFormContent());
    document.getElementById('playername').focus();
  }

  loginFormContent() {
    const defaultName = this.app.local ? 'Wolis' : '';
    return `
      <form method="dialog" id="loginform">
      <input type="hidden" name="type" value="login">
        <label for="playername">Who are you?</label>
        <input type="text" id="playername" name="playername" placeholder="Your name in cow" value="${defaultName}" required>
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
        Welcome back ${this.app.player.info.playername}
        <label for="pw">What is your password?</label>
        <input type="text" id="pw" name="pw" placeholder="Prove you are you">
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
        Welcome new player ${this.app.player.info.playername}.
        <label for="pw">Set your new password:</label>
        <input type="text" id="pw" name="pw" placeholder="So you can prove you are you">
        <menu>
          <button value="submit" class="buttonize">Continue</button>
        </menu>
      </form>
    `;
  }

  async handleLogon(data) {
    const obj = await this.app.db.findPlayer(data);

    console.log(`${this.app.name} logon `, obj);
    if (obj) {
      this.app.player.info.playername = obj.name;
      this.app.player.info.id = obj.id;
      if (this.app.window && !this.app.quickLogin && !this.app.local) {
        // show checkpw dialog
        this.app.ui.showDialog(this.checkPwContent(data));
        document.getElementById('pw').focus();
      } else {
        await this.logon(obj);
      }
    } else {
      // show new player dialog
      this.app.player.info.playername = data.playername;
      this.app.ui.showDialog(this.newPlayerContent(data));
      document.getElementById('pw').focus();
    }
  }

  async handleCheckPw(data) {
    const objPw = await this.app.db.getPw(this.app.player.info.id);
    const obj = await this.app.db.getById(this.app.player.info.id);

    if (obj && objPw) {
      const pwOk = await bcrypt.compare(data.pw, objPw);
      console.log(`${this.app.name} password ${data.pw} is ${pwOk}`);
      if (pwOk) {
        await this.logon(obj);
      } else {
        this.app.ui.alert(`Hmm... that didn't match. Try again`);
      }
    } else {
      this.app.ui.alert(`${this.app.player.info.playername} id=${this.app.player.info.id} can't be found`);
    }
  }

  async handleNewPlayer(data) {

    const hash = await bcrypt.hash(data.pw, 10);
    const startingLocation = '_2';
    const newId = this.app.id.new();
    const obj = {
      id: newId,
      class: 'player',
      name: this.info.playername,
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
   * Finalise login of player, saving into local storage for fast login next time
   * @params {object} obj
   */
  async logon(obj) {
    this.info.id = obj.id;
    this.info.loc = obj.loc;
    this.info.name = obj.name;
    this.app.storage?.setNamespace(this.info.id);
    this.save();
    this.app.name = obj.id;
    console.log(`${this.app.name} logs in`);
    await this.wake();
  }

  // clear player and show logoff message
  logoff() {
    this.clear();
  }

  async wake() {
    // get the last context seen by the server
    const result = await this.app.io.fetchJson('server', { 'lastContext': 1 });
    console.log(` ${this.app.name} wake `, result);
    this.app.lastContext = result?.lastContext || '0';
    await this.app.sendCommand({ cmd: 'look', actor: this.info.id, loc: this.info.loc, saveHistory: false });
    this.app.ui.closeDialog();
  }

  /**
   * Load players id and loc from local storage when browser opens
   */
  async load() {
    const json = this.app.storage?.getItem(this.PLAYER_INFO_KEY);
    if (json) {
      this.info = JSON.parse(json);
      this.info.history = Array.isArray(this.info.history) ? this.info.history : [];
      if (this.info.id) {
        this.app.storage?.setNamespace(this.info.id);
      }
      await this.wake();
      return;
    }
    this.info.history = Array.isArray(this.info.history) ? this.info.history : [];
    await this.welcome();
  }

  /**
   * Saves the players id and loc after logging in and each time their loc changes
   */
  save() {
    console.log(`${this.app.name} save player info`, this.info);
    this.app.storage?.setItem(this.PLAYER_INFO_KEY, JSON.stringify(this.info));
  }

  addHistory(cmd) {
    if (!cmd || typeof cmd !== 'string') return;
    cmd = cmd.trim();
    if (!cmd) return;
    if (!Array.isArray(this.info.history)) {
      this.info.history = [];
    }
    // If command already exists in history, remove old occurrence so it's not duplicated
    const existingIndex = this.info.history.indexOf(cmd);
    if (existingIndex !== -1) {
      this.info.history.splice(existingIndex, 1);
    }
    this.info.history.push(cmd);
    if (this.info.history.length > 50) {
      this.info.history.shift();
    }
    this.save();
  }

  clear() {
    this.info = { id: '', loc: '', history: [] };
    this.app.storage?.removeItem(this.PLAYER_INFO_KEY);
    this.app.storage?.setNamespace('0');
  }

}
