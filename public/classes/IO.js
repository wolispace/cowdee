// for handling data to and from server
export class IO {
  token = '';
  
  constructor(app) {
    this.app = app;
    this.type = {
      server: `${this.app.webroot}/server.php`, 
      sse: `${this.app.wrbroot}/sse.php`};
  }

  setToken(token) {
    this.token = token;
  }

  async loadJson(file) {
    const cached = this.app.storage?.getItem(file);
    if (cached) return JSON.parse(cached);

    const json = await this.fetchJson('server', {file, token: this.token});
    if (!json) return {};
    this.app.storage?.setItem(file, JSON.stringify(json));
    return json;
  }

  async saveJson(file, json) {
    this.app.storage?.setItem(file, JSON.stringify(json));
    return await this.fetchJson('server', {file, token: this.token, content: JSON.stringify(json)});
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
      return await response.json();
    } catch (err) {
      if (!window) {
        return await this.localDiskFallback(payload);
      }
      return null;
    }
  }

  async localDiskFallback(payload) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      if (payload.batch) {
        for (const [file, json] of Object.entries(payload.batch)) {
          const filePath = path.join('_db', `${file}.json`);
          fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
        }
        return { ok: true };
      }
      if (payload.file) {
        const filePath = path.join('_db', `${payload.file}.json`);
        if (payload.content) {
          fs.writeFileSync(filePath, payload.content);
          return { ok: true };
        } else if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return {};
      }
      if (payload.lastContext !== undefined) {
        const contextDir = '_contexts';
        if (fs.existsSync(contextDir)) {
          const files = fs.readdirSync(contextDir).filter(f => f.endsWith('.json')).sort();
          if (files.length > 0) {
            const last = files[files.length - 1].replace('.json', '');
            return { lastContext: last };
          }
        }
        return { lastContext: '0' };
      }
    } catch (e) {
      // ignore
    }
    return {};
  }

  flush() {
    console.log(`${this.app.name} flush local storage`);
    this.app.storage.clear(true);
  }

  makeShardFilename(type = '_', key = '_') {
    return `${type}_${key[0]}`;
  }

  async tryLock() {
    const response = await this.fetchJson('server', {lock: this.app.player.info.id});
    console.log(`${this.app.name} tryLock`, response.status);
    return response.status;
  }

  async unLock() {
    const response = await this.fetchJson('server', {lock: this.app.player.info.id, clear: 1});
    console.log(`${this.app.name} unLock`, response.status);
    return response.status;
  }
}
