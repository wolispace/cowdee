// Storage: simplified wrapper around localStorage (or simulated localStorage)
export class Storage {
  constructor(app) {
    this.app = app;
  }

  getItem(key) {
    return localStorage.getItem(key);
  }

  setItem(key, value) {
    localStorage.setItem(key, String(value));
  }

  removeItem(key) {
    localStorage.removeItem(key);
  }

  clear() {
    localStorage.clear();
  }

  // Compatibility stubs for legacy tests/code
  setNamespace() {}
  getNamespace() { return ''; }
}
