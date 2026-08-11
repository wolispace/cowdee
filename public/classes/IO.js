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
    localStorage.setItem(file, JSON.stringify(json));
    return json;
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
