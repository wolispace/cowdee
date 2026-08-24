// Handles namespaced local storage for per-player/session isolation
export class Storage {
  namespace = '0'; // default namespace '0' (void / unlogged)

  constructor(app, namespace = '0') {
    this.app = app;
    this.namespace = namespace || '0';
    this.memory = new Map();
  }

  setNamespace(namespace = '0') {
    this.namespace = namespace || '0';
  }

  getNamespace() {
    return this.namespace;
  }

  _key(key) {
    return `${this.namespace}:${key}`;
  }

  getItem(key) {
    const k = this._key(key);
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(k);
    }
    return this.memory.has(k) ? this.memory.get(k) : null;
  }

  setItem(key, value) {
    const k = this._key(key);
    const strVal = String(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(k, strVal);
    }
    this.memory.set(k, strVal);
  }

  removeItem(key) {
    const k = this._key(key);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(k);
    }
    this.memory.delete(k);
  }

  dump() {
    console.log(`\n${this.app.name} - memory: `, this.memory);
  }

  clear(allNamespaces = false) {
    if (allNamespaces) {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      this.memory.clear();
      return;
    }

    const prefix = `${this.namespace}:`;
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    }

    for (const k of Array.from(this.memory.keys())) {
      if (k.startsWith(prefix)) {
        this.memory.delete(k);
      }
    }
  }
}
