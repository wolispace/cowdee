// handles current player info, logging in, updating local storage
export class Player {

  info = {id: '', loc: ''};
  PLAYER_INFO_KEY = 'playerInfo';

  constructor(app) {
    this.app = app;
    this.load();
  }

  /** 
   * show the logon form 
   */
  async welcome() {
    if (!window) return;
    // show dialog, app.handleForm() handles logins
    this.app.ui.showDialog(this.loginFormContent()); 
    document.getElementById('playername').focus();   
  }

  loginFormContent() {
    return `
      <form method="dialog" id="loginform">
      <input type="hidden" name="type" value="login">
        <label for="playername">Who are you?</label>
        <input type="text" id="playername" name="playername" placeholder="Your name in cow" value="Wolis" required>
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
      // show checkpw dialog
      this.app.ui.showDialog(this.checkPwContent(data)); 
      document.getElementById('pw').focus(); 
    } else {
      // show new player dialog
      this.app.player.info.playername = data.playername;
      this.app.ui.showDialog(this.newPlayerContent(data)); 
      document.getElementById('pw').focus(); 
    }  
  }

  async handleCheckPw(data) {
    const obj = await this.app.db.getById(this.app.player.info.id);
    if (obj) {
      // DEBUG dont check password
      await this.logon(obj);
    } else {
      this.app.ui.alert(`Faild to find ${this.app.player.info.playername} id=${this.app.player.info.id}`);
    }
  }

  async handleNewPlayer(data) {
    const startingLocation = '_2';
    const obj = {
      id: this.app.id.new(), 
      class:'player', 
      name: this.info.playername, 
      loc: startingLocation, 
      color: 'gold',
      pw: data.pw};
    console.log(`${this.app.name} create new player ${this.app.player.info.playername}`);
    this.app.db.save(obj);
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
    await this.app.sendCommand({ cmd: 'look', actor: this.info.id, loc: this.info.loc });
    this.app.ui.closeDialog();
  }

  /**
   * Load players id and loc from local storage when browser opens
   */
  async load() {
    const json = this.app.storage?.getItem(this.PLAYER_INFO_KEY);
    if (json) {
      this.info = JSON.parse(json);
      if (this.info.id) {
        this.app.storage?.setNamespace(this.info.id);
      }
      await this.wake();
      return;
    }
    await this.welcome();
  }

  /**
   * Saves the players id and loc after logging in and each time their loc changes
   */
  save() {
    console.log(`${this.app.name} save player info`, this.info);
    this.app.storage?.setItem(this.PLAYER_INFO_KEY, JSON.stringify(this.info));
  }

  clear() {
    this.info = {};
    this.app.storage?.removeItem(this.PLAYER_INFO_KEY);
    this.app.storage?.setNamespace('0');
  }

}
