// for handling data to and from server
export class IO {
  token = '';

  constructor(app) {
    this.app = app;
    this.type = {
      server: `${this.app.webroot}/server.php`,
      sse: `${this.app.wrbroot}/sse.php`
    };
  }

  setToken(token) {
    this.token = token;
  }

  async loadJson(file) {
    const cached = this.app.storage?.getItem(file);
    if (cached) return JSON.parse(cached);

    const json = await this.fetchJson('server', { file, token: this.token });
    if (!json) return {};
    this.app.storage?.setItem(file, JSON.stringify(json));
    return json;
  }

  async saveJson(file, json) {
    this.app.storage?.setItem(file, JSON.stringify(json));
    return await this.fetchJson('server', { file, token: this.token, content: JSON.stringify(json) });
  }

  async saveBatch(batch) {
    for (const [file, json] of Object.entries(batch)) {
      this.app.storage?.setItem(file, JSON.stringify(json));
    }
    return await this.fetchJson('server', {
      batch: batch,
      token: this.token,
      counter: this.app.id.counter
    });
  }

  async fetchJson(type, payload) {
    payload.token = this.token;
    payload.counter = this.app.id.counter;
    try {
      const response = await fetch(this.type[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(400)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  flush() {
    console.log(`${this.app.name} flush local storage`);
    this.app.storage.clear(true);
  }

  makeShardFilename(type = '_', key = '_') {
    return `${type}_${key.charCodeAt(0)}`;
  }

  async tryLock() {
    const response = await this.fetchJson('server', { lock: this.app.player.info.id });
    console.log(`${this.app.name} tryLock`, response.status);
    return response.status;
  }

  async unLock() {
    const response = await this.fetchJson('server', { lock: this.app.player.info.id, clear: 1 });
    console.log(`${this.app.name} unLock`, response.status);
    return response.status;
  }
}
