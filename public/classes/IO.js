// for handling data to and from server
export class IO {
  static LZ_PREFIX = 'LZ:';
  token = '';

  // --- command queue ---
  _cmdQueue = [];   // pending cmd payloads
  _flushTimer = null; // debounce handle
  _FLUSH_MS = 10; // wait this long after last enqueue before sending

  constructor(app) {
    this.app = app;
    this.type = {
      server: `${this.app.webroot}/server.php`,
      sse: `${this.app.webroot}/sse.php`
    };
  }

  setToken(token) {
    this.token = token;
  }

  /**
   * Compresses data (object or string) into an ASCII Base64 LZ string with 'LZ:' prefix.
   * Produces compact [A-Za-z0-9+/=] characters (no unicode or \uXXXX escaping).
   * If LZString is not loaded, falls back to raw data gracefully.
   */
  compress(data) {
    if (data === null || data === undefined || this.app.settings.nocompress) return data;
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      if (typeof LZString !== 'undefined' && LZString?.compressToBase64) {
        const compressed = IO.LZ_PREFIX + LZString.compressToBase64(str);
        return compressed.length < str.length ? compressed : str;
      }
      return data;
    } catch (err) {
      console.warn('Compression error:', err);
      return data;
    }
  }

  /**
   * Decompresses data if compressed with LZString Base64.
   */
  decompress(data) {
    if (data === null || data === undefined || this.app.settings.nocompress) return data;
    if (typeof data === 'string' && data.startsWith(IO.LZ_PREFIX)) {
      try {
        if (typeof LZString !== 'undefined' && LZString?.decompressFromBase64) {
          if (!data.startsWith(IO.LZ_PREFIX)) return data;
          const raw = LZString.decompressFromBase64(data.slice(IO.LZ_PREFIX.length));
          if (raw === null || raw === undefined) return data;
          try {
            return JSON.parse(raw);
          } catch {
            return raw;
          }
        }
      } catch (err) {
        console.warn('Decompression error:', err);
        return data;
      }
    }
    return data;
  }

  async loadJson(file) {
    this.app.ui.showLoading();
    try {
      const json = await this.fetchJson('server', { file, token: this.token, pid: this.app.player.pid() });
      return json || {};
    } finally {
      this.app.ui.hideLoading();
    }
  }

  async loadFiles(files) {
    if (!files || files.length === 0) return {};
    this.app.ui.showLoading();
    try {
      const json = await this.fetchJson('server', { files, token: this.token, pid: this.app.player.pid() });
      return json || {};
    } finally {
      this.app.ui.hideLoading();
    }
  }

  async saveJson(file, json) {
    return await this.fetchJson('server', {
      file,
      token: this.token,
      pid: this.app.player.pid(),
      content: JSON.stringify(json)
    });
  }

  async saveBatch(batch) {
    return await this.fetchJson('server', {
      batch: batch,
      token: this.token,
      pid: this.app.player.pid(),
      counter: this.app.id.counter
    });
  }
  async fetchJson(type, payload) {
    payload.token = this.token;
    payload.pid = this.app.player.pid();
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

    // console.log(`${this.app.name} flushing ${commands.length} queued command(s)`);
    const result = await this._doFetch('server', {
      commands,
      token: this.token,
      pid: this.app.player.pid(),
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
