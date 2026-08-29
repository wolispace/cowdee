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
    const json = await this.fetchJson('server', { file, token: this.token });
    return json || {};
  }

  async loadFiles(files) {
    if (!files || files.length === 0) return {};
    const json = await this.fetchJson('server', { files, token: this.token });
    return json || {};
  }

  async saveJson(file, json) {
    return await this.fetchJson('server', { file, token: this.token, content: JSON.stringify(json) });
  }

  async saveBatch(batch) {
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
        signal: AbortSignal.timeout(1000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.log(`${this.app.name} fetch error`, err);
      this.app.ui.hideLoading();
      return null;
    }
  }

  flush() {
    console.log(`${this.app.name} flush pools`);
    this.app.db.flush();
  }

  makeShardFilename(type = '_', key = '_') {
    const k = String(key);
    return `${type}_${k.charCodeAt(0)}`;
  }

  async tryLock() {
    const lockId = this.app.player.info.id || this.app.name || 'admin';
    const response = await this.fetchJson('server', { lock: lockId });
    console.log(`${this.app.name} tryLock`, response?.status);
    return !!response?.status;
  }

  async unLock() {
    const lockId = this.app.player.info.id || this.app.name || 'admin';
    const response = await this.fetchJson('server', { lock: lockId, clear: 1 });
    console.log(`${this.app.name} unLock`, response?.status);
    return !!response?.status;
  }
}
