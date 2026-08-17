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
  welcome() {
    // show dialog,
    // try to login
    // if success then wake player
    // if faile then reshow dialog
  }

  /**
   * Validate player, return true if logged in OK
   * @return {boolean}
   */
  async logon(user, pw) {
    const obj = await this.app.db.findPlayer({ playername: user, pw: pw });
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

  /**
   * Load players id and loc from local storagte when browser opens
   */
  async load() {
    
    const json = localStorage.getItem(this.PLAYER_INFO_KEY);
    if (json) {
      this.info = JSON.parse(json);
      return;
    }
    console.log('DEBUG auto login as wolis');
    const obj = await this.app.db.findPlayer({ playername: 'wolis', pw: '' });
    if (obj) {
      this.info = {id: obj.id, loc: obj.loc};
    } else {
      console.log("DEBUG: summry player");
      this.info = {id: 'wol', loc: '2'};
    }
    this.save();
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
    localStorage.clear(PLAYER_INFO_KEY);
  }

}
