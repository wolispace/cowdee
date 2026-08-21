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
    // show dialog, app.handleForm() handes logins
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
      alert(`Player ${data.playername} not found.`);
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
      this.save();
      return true;
    }
    return false;
  }

  // clear player and show logoff message
  logoff() {
    this.clear();
  }

async wake() {
    // get the last comntext seen by the server
    const last = await this.app.io.fetchJson('server', {'last': 1});
    console.log({last});
    this.app.lastContext = last.last;
    await this.app.sendCommand({cmd: 'look', actor: this.info.id, loc: this.info.loc});
  }

  /**
   * Load players id and loc from local storagte when browser opens
   */
  async load() {
    
    const json = localStorage.getItem(this.PLAYER_INFO_KEY);
    if (json) {
      this.info = JSON.parse(json);
      return;
    }
    await this.welcome();
  }

  /**
   * Saves the players id and loc after logging in and each time their loc changes
   */
  save() {
    console.log('save player info', this.info);
    localStorage.setItem(this.PLAYER_INFO_KEY, JSON.stringify(this.info));
  }

  clear() {
    this.info = {};
    localStorage.clear(this.PLAYER_INFO_KEY);
  }

}
