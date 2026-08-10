// for handling data to and from server
export class IO {
  token = '';
  types = {server: '/public/server.php', player: '/?player'};

  constructor(app) {
    this.app = app;
  }

  setToken(token) {
    this.token = token;
  }

  async loadJson(filename) {
    let json = localStorage.getItem(filename);
    if (!json) {
      // load json from the server
      const payload = {filename: filename, token: this.token};
      json = await this.fetchJson('server', payload);
    }
    return json;
  }

  async fetchJson(type, json) {
    json.token = this.token;

    const response = await fetch(this.types[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    });

    return await response.json();
  }
}
