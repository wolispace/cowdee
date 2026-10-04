// for handling data to and from server
export class IO {
  token = '';

  // --- command queue ---
  _cmdQueue   = [];   // pending cmd payloads
  _flushTimer = null; // debounce handle
  _FLUSH_MS   = 1000; // wait this long after last enqueue before sending

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
    payload.token   = this.token;
    payload.counter = this.app.id.counter;

    // cmd payloads go through the queue; everything else fires immediately
    if (payload.cmd) {
      return this._enqueueCmd(payload);
    }
    return this._doFetch(type, payload);
  }

  /**
   * Adds a cmd payload to the queue and arms the debounce flush timer.
   * Returns a Promise that resolves when the batch containing this cmd
   * has been sent and acknowledged by the server.
   */
  _enqueueCmd(payload) {
    return new Promise((resolve, reject) => {
      this._cmdQueue.push({ payload, resolve, reject });
      // reset the debounce window
      if (this._flushTimer) clearTimeout(this._flushTimer);
      this._flushTimer = setTimeout(() => this._flushQueue(), this._FLUSH_MS);
    });
  }

  /**
   * Drains the queue and sends all pending commands as one request.
   * { commands: [ payload, payload, ... ] }
   */
  async _flushQueue() {
    this._flushTimer = null;
    if (this._cmdQueue.length === 0) return;

    // snapshot and clear the queue atomically
    const batch = this._cmdQueue.splice(0, this._cmdQueue.length);
    const commands = batch.map(item => item.payload);

    console.log(`${this.app.name} flushing ${commands.length} queued command(s)`);
    const result = await this._doFetch('server', {
      commands,
      token:   this.token,
      counter: this.app.id.counter
    });

    // resolve every waiting caller with the shared result
    for (const item of batch) {
      item.resolve(result);
    }
  }

  /**
   * Raw fetch — shared by the queue flush and all non-cmd calls.
   */
  async _doFetch(type, payload) {
    try {
      // console.log(`${this.app.name} __ _doFetch(${this.type[type]}) payload:`, JSON.stringify(payload));
      const response = await fetch(this.type[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000) // longer timeout for batches
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

  async tryLock() {
    const lockId = this.app.player.id || this.app.name || 'admin';
    const response = await this.fetchJson('server', { lock: lockId });
    console.log(`${this.app.name} tryLock`, response?.status);
    return !!response?.status;
  }

  async unLock() {
    const lockId = this.app.player.id || this.app.name || 'admin';
    const response = await this.fetchJson('server', { lock: lockId, clear: 1 });
    console.log(`${this.app.name} unLock`, response?.status);
    return !!response?.status;
  }
}
