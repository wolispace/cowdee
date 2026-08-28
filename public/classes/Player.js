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
  }

  loginFormContent() {
    return `
      <form method="dialog" id="loginform">
      <input type="hidden" name="type" value="login">
        <label for="playername">Your name:</label>
        <input type="text" id="playername" name="playername" placeholder="Your name in cow" required>
        <label for="pw">Password:</label>
        <input type="password" id="pw" name="pw" placeholder="Prove your you">
        <!-- <label for="email">Email:</label>
        <input type="text" id="email" name="email" placeholder="Optional. For email recovery">
        -->
        <menu>
          <button value="submit" class="buttonize">Login</button>
        </menu>
      </form>
    `;
  }

  async handleLogon(data) {
    const isLoggedIn = await this.logon(data);
    if (isLoggedIn) {
      this.app.ui.closeDialog();
      await this.wake();
    } else {
      if (!window) {
        console.warn(`Player ${data.playername} not found.`);
      } else {
        alert(`Player ${data.playername} not found.`);
      }
    }
  }

  /**
   * Validate player, return true if logged in OK
   * @return {boolean}
   */
  async logon(data) {
    const obj = await this.app.db.findPlayer(data);
    if (obj) {
      this.info.id = obj.id;
      this.info.loc = obj.loc;
      this.info.name = obj.name;
      this.app.storage?.setNamespace(this.info.id);
      this.save();
      this.app.name = obj.id;
      console.log(`${this.app.name} logs in`);
 
      return true;
    }
    return false;
  }

  // clear player and show logoff message
  logoff() {
    this.clear();
  }

  async wake() {
          // clear browsers cache of previous world when we log in
      this.app.io.flush();
    // get the last context seen by the server
    const result = await this.app.io.fetchJson('server', {'lastContext': 1});
    console.log(` ${this.app.name} wake `, result);
    this.app.lastContext = result?.lastContext || '0';
    await this.app.sendCommand({cmd: 'look', actor: this.info.id, loc: this.info.loc});
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
