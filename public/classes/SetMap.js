// a Map of Sets {"A": ["a", "b", "c"], "x": ["X", "Y"]}
export class SetMap {
  dirtyUpdated = new Set(); // shard prefixes of the updated keys
  dirtyDeleted = new Set(); // shard prefixes of the deleted keys
  
  constructor() {
    this.map = new Map();
  }

  add(key, value) {
    this.set(key, value);
  }

  set(key, value) {
    const set = this.map.get(key) ?? new Set();
    set.add(value);
    this.map.set(key, set);
    this.dirtyUpdated.add(key[0]);
  }

  get(key) {
    return this.map.get(key) ?? new Set();
  }

  replace(key, newSet) {
    this.map.set(key, newSet);
    this.dirtyUpdated.add(key[0]);
  }

  /**
   * Return tru if just they key exists or the key exists and it has the value
   * @param {string} key 
   * @param {string} value 
   * @returns 
   */
  has(key, value = null) {
    if (value == null) {
      return this.map.has(key);
    }
    const set = this.map.get(key);
    return set ? set.has(value) : false;
  }

  sort() {
    this.map = new Map([... this.map.entries()].sort(([a], [b]) =>
      a.localeCompare(b)));
  }

  deleteKey(key) {
    this.map.delete(key);
    this.dirtyDeleted.add(key[0]);
  }

  deleteValue(key, value) {
    const set = this.map.get(key);
    if (!set) return;
    set.delete(value);
    this.dirtyUpdated.add(key[0]);
    if (set.size === 0) {
      this.map.delete(key);
      return true;
    }
  }

  entries() {
    return this.map.entries();
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }

  clear() {
    this.map.clear();
  }

  /**
   * Return a json object of all the keys starting with the shard prefix
   * @param {string} prefix 
   * @returns {object}
   */
  getShard(prefix) {
    const shard = {};
    for (const [key, set] of this.map.entries()) {
      if (key[0] === prefix) {
        shard[key] = [...set];
      }
    }
    return shard;
  }

  /**
   * Returns true if either update or delete is dirty
   * @returns {boolean}
   */
  isDirty() {
    return (this.dirtyUpdated.size > 0 || this.dirtyDeleted.size > 0);
  }

  // output the contents as a json object with arrays instead of sets
  toJson() {
    const obj = Object.fromEntries(
      [...this.map.entries()].map(([key, set]) => [key, [...set]])
    );
    return JSON.stringify(obj);
  }
}
