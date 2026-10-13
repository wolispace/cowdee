// Storage: simplified wrapper around localStorage (or simulated localStorage)
export class Storage {
  constructor(app) {
    this.app = app;
  }

  static _mem = {};

  getItem(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage?.getItem) {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return Storage._mem[key] ?? null;
  }

  setItem(key, value) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage?.setItem) {
        localStorage.setItem(key, String(value));
        return;
      }
    } catch (e) {}
    Storage._mem[key] = String(value);
  }

  removeItem(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage?.removeItem) {
        localStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    delete Storage._mem[key];
  }

  clear() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage?.clear) {
        localStorage.clear();
        return;
      }
    } catch (e) {}
    Storage._mem = {};
  }

  // Compatibility stubs for legacy tests/code
  setNamespace() {}
  getNamespace() { return ''; }
}
