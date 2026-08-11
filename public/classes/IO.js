// for handling data to and from server
export class IO {
  token = '';
  types = {server: 'http://localhost:8880/public/server.php', player: 'http://localhost/?player'};

  constructor(app) {
    this.app = app;
  }

  setToken(token) {
    this.token = token;
  }

  async loadJson(file) {
    const cached = localStorage.getItem(file);
    if (cached) return JSON.parse(cached);
    const json = await this.fetchJson('server', {file, token: this.token});
    if (!json) {
      console.log('fetched nothing');
      return {};
    } else {
      console.log('fetched', json);
    }
    localStorage.setItem(file, JSON.stringify(json));
    return json;
  }

  async saveJson(file, json) {
    const result = await this.fetchJson('server', {file: file, token: this.token, content: JSON.stringify(json)});
    if (!result) {
      console.log('failed to send');
      return false;
    } else {
      console.log('sent', json);
      return true;
    }
  }

async fetchJson(type, payload) {
    payload.token = this.token;
    console.log(`fetchJson ${type} payload=`, payload);
    const response = await fetch(this.types[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return await response.json();
  }

  flush() {
    localStorage.clear();
  }

  makeShardFilename(type = '_', key = '_') {
    return `${type}_${key[0]}`;
  }
}
