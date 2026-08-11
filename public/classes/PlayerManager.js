// handls all interactions with players, logging in authenticating, storing stuff, movnig locations
export class PlayerManager {
  #sessions = new Map(); // token -> username

  constructor(app) {
    this.app = app;
  }

  handle(request, result) {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', async () => {
      const data = JSON.parse(body);
      let playerState = {};
      if (!data) { result.writeHead(401); result.end(); return({type: "empty"}); }

      if (data.type == 'return') {
        const obj = await this.app.db.getById(data.id);
        if (!obj) {
          return {type: "no obj ", data: {data}};
        }
        //console.log(`get data.id`, data.id, obj);
         playerState = { type: "return", id: obj.id, playername: obj.name, loc: obj.loc };
      } else if (data.type == 'login') {
        const obj = await this.app.db.findPlayer(data);
        if (!obj) {
          playerState = {type: "login"};
        } else {
          this.#sessions[data.token] = data;
          playerState = { type: "login", id: obj.id, playername: obj.name, loc: obj.loc };
        }
      } else if (data.type == 'logoff') {

      } else {

      }
      result.writeHead(200, {
        'Content-Type': 'application/json'
      });
      result.end(JSON.stringify(playerState));
    });
  }


  getSession(request) {
    const cookie = request.headers.cookie ?? '';
    const token = cookie.match(/session=([^;]+)/)?.[1];
    return token ? this.#sessions[token] : null;
  }

  async #validate(user, pw) {
    // TODO: check DB with hashed pw
    const obj = await this.app.db.findPlayer({ playername: user, pw: pw });
    return (obj) ? true : false;
  }

  /**
   * Adds the user to the list of current players
   * @param {string} user 
   * @param {string} pw 
   */
  async add(user, pw) {
    const obj = await this.app.db.findPlayer({ playername: user, pw: pw });
    const token = crypto.randomUUID();
    this.#sessions.set(token, {user: user, pw: pw});
  }
}
