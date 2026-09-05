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
    // only ID is mixed case so we can find things like name in mixed case
    if (type !== 'id') key = key.toLowerCase();
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
    for (const type of Object.keys(this.dirty) ) {
      for (const prefix of this.dirty[type] ) {
        const filename = `${type}_${prefix}`;
        const data = this.memory[type][prefix];
        await this.app.io.saveJson(filename, data);
      }
    }
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
    return key[0].toUpperCase();
  }

  // manipulate objects within each type/prefix/key

  /**
   * Adds an object into memory eg {id: 'wol', name: 'Wolis', loc: '2'}
   * @param {object} obj 
   */
  async add(obj) {
    // --- ID shard ---
    this.set('id', obj.id, obj);

    // --- NAME shard ---
    // TODO: build name from class and name 
    // loop through all words and add to the 'name' list
    const word = obj.name
    const nameKey = word.toLowerCase();
    const nameList = await this.get('name', nameKey) ?? [];
    nameList.push(obj.id);
    await this.set('name', nameKey, nameList);

    // --- LOC shard ---
    const locList = await this.get('loc', obj.loc) ?? [];
    locList.push(obj.id);
    await this.set('loc', obj.loc, locList);

    // --- CODE shard ---
    if (obj.code) {
      this.set('code', obj.id, {loc: obj.loc, code: obj.code});
    }
   // --- INFO shard ---
    if (obj.info) {
      this.set('info', obj.id, obj.info);
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
   * Remove the object from the existance
   * @param {string} id 
   * @returns 
   */
  async remove(id) {
    const obj = await this.get('id', id);
    if (!obj) return;

    const { name, loc } = obj;

    // --- Remove from ID shard ---
    const prefix = this.prefix(id);
    const idShard = this.memory.id[prefix];
    delete idShard[id];

    // --- Remove from NAME shard ---
    const nameKey = name.toLowerCase();
    const nameList = await this.get('name', nameKey) ?? [];
    await this.set('name', nameKey, nameList.filter(x => x !== id));

    // --- Remove from LOC shard ---
    const locList = await this.get('loc', loc) ?? [];
    await this.set('loc', loc, locList.filter(x => x !== id));

    // --- Remove from CODE chard ---
    const codeList = await this.get('code', obj.code) ?? {};
    delete codeList[id];

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

  toString() {
    return JSON.stringify(this.memory, null, 2);
  }
}
