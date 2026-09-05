export class DB2 {

  memory = {};
  dirty = {};

  // see tests/DB2.php for some sample data

  constructor(app) {
    this.app = app;
  }

  /**
   * Returns the obj of this type found matching the key
   * eg: db.get('id', 'wol') or db.get('name','Wolis')
   * @param {string} type eg 'id' or 'name'
   * @param {string} key 
   * @returns {object}
   */
  async get(type, key) {
    const prefix = this.prefix(key);
    // only name is lowercased so we can find things like name in mixed case
    // id, code, and info are all keyed by object ID which preserves case
    if (['name'].includes(type)) key = key.toLowerCase();
    if (!this.memory[type]) {
      this.memory[type] = {};
    }
    if (!this.memory[type][prefix]) {
      this.memory[type][prefix] = await this.app.io.loadJson(`${type}_${prefix}`);
    };
    return this.memory[type][prefix][key];
  }

  /**
   * Wrights into memory the value for this type and key
   * @param {string} type 
   * @param {string} key 
   * @param {any} value 
   */
  async set(type, key, value) {
    
    const prefix = this.prefix(key);
    // so we can find matching names regardless of case
    if (['name'].includes(type)) key = key.toLowerCase();
    
    console.log(`${this.app.name} - set`, {type, prefix, key, value});
    // Ensure memory type and shard is in memory
    let mtype = this.memory[type];
    if (!mtype) {
      this.memory[type] = {};
      console.log(`${this.app.name} - had to make mtype`, type );
    }
    let shard = this.memory[type][prefix];
    if (!shard) {
      shard = await this.app.io.loadJson(`${type}_${prefix}`);
      console.log(`${this.app.name} - had to make shard`, type, prefix, 'shard', shard);
      this.memory[type][prefix] = shard;
    }
    shard[key] = value;
    this.markDirty(type, prefix);
    this.memory[type][prefix] = shard;
    console.log(`${this.app.name} - added into memory`, type, prefix, 'shard', shard);
  }

  // mark this shard as dirty for saving to disk later
  markDirty(type, prefix) {
   if (!this.dirty[type]) {
      this.dirty[type] = new Set();
    }
    this.dirty[type].add(prefix); 
  }

  /**
   * Save all firty shards to disk
   */
  async saveToDisk() {
    console.log(`${this.app.name} dirty`, this.dirty);
    const batch = {};
    for (const type of Object.keys(this.dirty) ) {
      for (const prefix of this.dirty[type] ) {
        const filename = `${type}_${prefix}`;
        const data = this.memory[type][prefix];
        batch[filename] = data;       
      }
    }
    console.log(`${this.app.name} TODO save batch`, batch);
    await this.app.io.saveBatch(batch);
    this.dirty = {};
  }

  /**
   * Returns the first latter of the key eg 'w' forom 'wolis'
   * in production we return the ascii value eg '65' for 'A'
   * But DEBUG just uppercases the value from easy of finding things
   * @param {string} key 
   * @returns {string}
   */
  prefix(key = '_') {
    return String(key)[0].toUpperCase();
  }

  // manipulate objects within each type/prefix/key

  /**
   * Adds or updates an object into memory eg {id: 'wol', name: 'Wolis', loc: '2'}
   * @param {object} obj 
   */
  async save(obj) {
    // TODO: optimise this so we only remove/make dirty things that have changed
    if (await this.get('id', obj.id)) {
      this.remove(obj.id);
    }

    // --- ID shard ---
    await this.set('id', obj.id, obj);

    // --- NAME shard is built from all words in class and name ---
    let longName = obj.class;
    if (obj.name) {
      longName += ` ${obj.name}`;
    }
    const words = longName.split(' ');
    for ( const word of words) {
      const nameKey = word.toLowerCase();
      const nameList = await this.get('name', nameKey) ?? [];
      nameList.push(obj.id);
      await this.set('name', nameKey, nameList);
    }

    // --- LOC shard ---
    const locList = await this.get('loc', obj.loc) ?? [];
    locList.push(obj.id);
    await this.set('loc', obj.loc, locList);

    // --- CODE shard ---
    if (obj.code) {
      await this.set('code', obj.id, {loc: obj.loc, code: obj.code});
    }
    // --- INFO shard ---
    if (obj.info) {
      await this.set('info', obj.id, obj.info);
    }
  }

  /**
   * Moves object into the new location
   * @param {string} id 
   * @param {string} newLoc 
   * @returns 
   */
  async move(id, newLoc) {
    const obj = await this.get('id', id);
    if (!obj) return;

    const oldLoc = obj.loc;

    // --- Remove from old location ---
    const oldList = await this.get('loc', oldLoc) ?? [];
    const filtered = oldList.filter(x => x !== id);
    await this.set('loc', oldLoc, filtered);

    // --- Add to new location ---
    const newList = await this.get('loc', newLoc) ?? [];
    newList.push(id);
    await this.set('loc', newLoc, newList);

    // --- Update object itself ---
    obj.loc = newLoc;
    await this.set('id', id, obj);
  }

  /**
   * Remove the object from existance
   * @param {string} id 
   * @returns 
   */
  async remove(id) {
    const obj = await this.get('id', id);
    if (!obj) return;

    // --- Remove from ID shard ---
    const prefix = this.prefix(id);
    if (this.memory.id?.[prefix]) {
      delete this.memory.id[prefix][id];
      this.markDirty('id', prefix);
    }

    // --- NAME shard is built from all words in class and name ---
    let longName = obj.class;
    if (obj.name) {
      longName += ` ${obj.name}`;
    }
    const words = longName.split(' ');
    for ( const word of words) {
      const nameKey = word.toLowerCase();
      const nameList = await this.get('name', nameKey) ?? [];
      await this.set('name', nameKey, nameList.filter(x => x !== id));
    }

    // --- Remove from LOC shard ---
    const locList = await this.get('loc', obj.loc) ?? [];
    await this.set('loc', obj.loc, locList.filter(x => x !== id));

    // --- Remove from CODE shard ---
    const codePrefix = this.prefix(id);
    if (this.memory.code?.[codePrefix]?.[id]) {
      delete this.memory.code[codePrefix][id];
      this.markDirty('code', codePrefix);
    }

    // --- Remove from INFO shard ---
    const infoPrefix = this.prefix(id);
    if (this.memory.info?.[infoPrefix]?.[id]) {
      delete this.memory.info[infoPrefix][id];
      this.markDirty('info', infoPrefix);
    }
  }

  /**
   * Renames an object
   * @param {string} id 
   * @param {string} newName 
   * @returns 
   */
  async rename(id, newName) {
    const obj = await this.get('id', id);
    if (!obj) return;

    const oldNameKey = obj.name.toLowerCase();
    const newNameKey = newName.toLowerCase();

    // --- Remove from old name list ---
    const oldList = await this.get('name', oldNameKey) ?? [];
    await this.set('name', oldNameKey, oldList.filter(x => x !== id));

    // --- Add to new name list ---
    const newList = await this.get('name', newNameKey) ?? [];
    newList.push(id);
    await this.set('name', newNameKey, newList);

    // --- Update object ---
    obj.name = newName;
    await this.set('id', id, obj);
  }

  /**
   * Flush memory and dirty and reset counter
   */
  flush() {
    this.memory = {};
    this.dirty = {};
    this.counter = 1;
  }

  /**
   * Returns the entire memory object as a json string
   * @returns string
   */
  toString() {
    return JSON.stringify(this.memory, null, 2);
  }
}
