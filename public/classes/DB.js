export class DB {

  memory = {};
  dirty = {};
  interval = 5_000;

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

    /** TODO: do we need this still?
   * Preloads all shard files needed for an array/Set of keys in a single batch request
   * @param {Iterable<string>} keys 
   */
  async preload(keys) {
    if (!keys) return;
    const filenames = new Set();
    for (const key of keys) {
      if (!this.pool.has(key)) {
        filenames.add(this.app.io.makeShardFilename(this.type, key));
      }
    }
    if (filenames.size === 0) return;

    const fileMap = await this.app.io.loadFiles([...filenames]);
    for (const items of Object.values(fileMap)) {
      this.populateFromShard(items);
    }
  }

  
    /**
   * Returns the whole object from a chunked file
   * @param {string} id 
   * @returns {object}
   */
  async getById(id) {
    return await this.get('id', id);
  } 


  /**
   * Returns an array of IDs with the required word eg: "cat" returns ["AB", "Ax" ...]
   * @param {string} word 
   * @returns {set} of IDs with this name
   */
  async findByName(word) {
    const name = word.replace(/^(?:the|an|a)\b/i, '').trim().toLocaleLowerCase();
    return await this.get('name', name);
  };

   /**
   * Return the obj of the player matching the name
   * TODO: worry about passwords later
   * @param {object} data with data.username and data.pw
   * @returns {object}
   */
  async findPlayer(data) {
    const candidates = await this.findByName(data.playername);
    if (!candidates) return undefined;
    // check all candidates to ensure they are class='player'
    // TODO: worry about password later
    for (const id of candidates) {
      const obj = await this.getById(id);
      if (obj?.class == 'player') {
        // first player with matching name..
        // TODO: compare passwords too
        return obj;
      }
    }
  }

    /**
   * Find the first named object in the location
   * @param {string} name 
   * @param {string} loc 
   * @returns {string} the ID of the found object
   */
  async findByNameInLoc(name, loc) {
    const inName = await this.findByName(name);
    if (!inName || inName.length < 1) return undefined;
    if (loc == 'all') {
      return inName[0];
    }

    const inLoc = await this.findInLoc(loc);
    if (!inLoc) return undefined;
    for (const key of inLoc) {
      if (inName.includes(key)) {
        return key;
      }
    }
  }


    /**
   * Returns an array of object IDs in the location
   * @param {string} key 
   * @returns {set}
   */
  async findInLoc(key) {
    return await this.get('loc', key);
  }

    /**
   * Retruns the code for the object.id passed in
   * for consistancy, even tho its just a string, its stored in an array with one element
   * @param {id} id 
   * @returns {string}
   */
  async getCode(id) {
    const obj = await this.get('code', id);
    if (!obj) return '';
    return obj?.code.replaceAll('\\n','\n') ?? '';
  };

  /**
   * Retruns the info for the object.id passed in
   * for consistancy, even tho its just a string, its stored in an array with one element
   * @param {id} id 
   * @returns {string}
   */
  async getInfo(id) {
    const objInfo = await this.get('info', id);
    if (!objInfo) return '';
    return objInfo.replaceAll("\\n","\n") ?? '';
  };

  
  /**
   * Find the first named command (look in player then location then globaly so long as its a command)
   * "find" means look for it somewhere, where as "get" means we know it so get it.
   * @param {string|object} firstword 
   * @param {object} [context] 
   * @returns {string} return the code from the bext match object
   */
  async findCommand(context) {
    const ids = await this.findByName(context.cowmand);

    if (!ids || ids.length < 1) return '';
    if (ids.length === 1) {
      const [id] = ids;
      return await this.getCode(id);
    }
    for (const id of ids) {
      const obj = await this.getById(id);
      if (!obj) continue;
      if (obj.loc === context.actor) {
        return await this.getCode(id);
      }
      if (obj.loc === context.loc) {
        return await this.getCode(id);
      }
      if (obj.class === 'command') {
        return await this.getCode(id);
      }
    }
    return '';
  };

  
  /**
   * Adds formatted/processed versions of values within the object. Saved to disk so we dont need to reprocess again.
   * Each time an object is added to the pools its re formatted.
   * @param {obj} obj 
   * @returns nothing, the obj is updated
   */
  formatObject(obj) {
    this.formatQty(obj);
    this.formatPlural(obj);
    if (obj.qty == 1) {
      obj.is = 'is';
      obj.gender = 'it';
    } else {
      obj.is = 'are';
      obj.gender = 'them';
    }
    obj.longname = `${obj.qtyText} ${obj.plural}`;
    if (obj.name) {
      obj.longname += ' called ' + obj.name;
    }
    if (['player', 'command'].includes(obj.class)) {
      obj.longname = obj.name;
    }
  }

  /**
   * Formats the qty as a string eg 30 = many
   * @param {obj} obj 
   * @returns nothing, updates obj
   */
  formatQty(obj) {
    obj.qty = !obj.qty ? 1 : obj.qty;
    obj.qtyText = obj.qty;
    if (obj.qty == 1) {
      obj.qtyText = ['a', 'e', 'i', 'o', 'u'].includes(obj.class[0]) ? 'an' : 'a';
    } else if (obj.qty == 2) {
      obj.qtyText = 'two';
    } else if (obj.qty == 3) {
      obj.qtyText = 'three';
    } else if (obj.qty == -1) {
      obj.qtyText = 'the';
    } else if (obj.qty < 10) {
      obj.qtyText = obj.qty;
    } else if (obj.qty < 20) {
      obj.qtyText = 'some';
    } else if (obj.qty < 99) {
      obj.qtyText = 'many';
    } else if (obj.qty < 999) {
      obj.qtyText = 'hundreds of';
    } else if (obj.qty < 999999) {
      obj.qtyText = 'thousands of';
    } else if (obj.qty < 999999999) {
      obj.qtyText = 'millions of';
    } else {
      obj.qtyText = 'a mind-boggling quantity of';
    }
  }

  /**
   * Formats the plural version of this object
   * @param {object} obj 
   * @returns nothing, updates obj
   */
  formatPlural(obj) {
    obj.plural = '';
    if (obj.qty > 1) {
      const plurals = { 'knife': 'knives', 'sheep': 'sheep', 'loaf': 'loaves', 'mouse': 'mice' };
      const plural = plurals[obj.class];
      obj.plural = (plural === undefined) ? obj.class + 's' : plural;
    } else {
      obj.plural = obj.class;
    }
  }

/////////////////////////////////////////////////////////////////////////

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
    
    // console.log(`${this.app.name} - set`, {type, prefix, key, value});
    // Ensure memory type and shard is in memory
    let mtype = this.memory[type];
    if (!mtype) {
      this.memory[type] = {};
      // console.log(`${this.app.name} - had to make mtype`, type );
    }
    let shard = this.memory[type][prefix];
    if (!shard) {
      shard = await this.app.io.loadJson(`${type}_${prefix}`);
      // console.log(`${this.app.name} - had to make shard`, type, prefix, 'shard', shard);
      this.memory[type][prefix] = shard;
    }
    shard[key] = value;
    this.markDirty(type, prefix);
    this.memory[type][prefix] = shard;
    // console.log(`${this.app.name} - added into memory`, type, prefix, 'shard', shard);
    this.debounceSave();
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
    // console.log(`${this.app.name} dirty`, this.dirty);
    const batch = {};
    for (const type of Object.keys(this.dirty) ) {
      for (const prefix of this.dirty[type] ) {
        const filename = `${type}_${prefix}`;
        const data = this.memory[type][prefix];
        batch[filename] = data;       
      }
    }
    // console.log(`${this.app.name} TODO save batch`, batch);
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
    // return String(key)[0].charCodeAt(0);
  }

  // manipulate objects within each type/prefix/key

  /**
   * Adds the value to the location list
   * @param {string} loc
   * @param {string} value
   */
  async addLoc(loc, value) {
    const locList = await this.get('loc', loc) ?? [];
    locList.push(value);
    await this.set('loc', loc, locList);
  }
  
  /**
   * Removes the value from the location list
   * @param {strine} loc 
   * @param {string} value 
   */
  async removeLoc(loc, value) {
    const locList = await this.get('loc', loc) ?? [];
    const filtered = locList.filter(x => x !== value);
    await this.set('loc', loc, filtered);
  }

  /**
   * Adds each of the words from the array into the names shards
   * @param {array of strings} words 
   * @param {string} id 
   */
  async addName(words, id) {
    for ( const word of words) {
      const nameKey = word.toLowerCase();
      const nameList = await this.get('name', nameKey) ?? [];
      nameList.push(id);
      await this.set('name', nameKey, nameList);
    }
  }

  /**
   * removes each of the words from the array into the names shards
   * @param {array of strings} words 
   * @param {string} id 
   */
  async removeName(words, id) {
    for ( const word of words) {
      const nameKey = word.toLowerCase();
      const nameList = await this.get('name', nameKey) ?? [];
      await this.set('name', nameKey, nameList.filter(x => x !== id));
    }
  }

  /**
   * Adds the code into the code shard
   * @param {object} obj 
   */
  async addCode(obj) {
    await this.set('code', obj.id, {loc: obj.loc, code: obj.code});
  }
  
  /**
   * Remove code from code shard
   * @param {object} obj 
   */
  async removeCode(obj) {
    const prefix = this.prefix(obj.id);
    if (this.memory.code?.[prefix]?.[obj.id]) {
      delete this.memory.code[prefix][obj.id];
      this.markDirty('code', prefix);
    }
  }
  
  /**
   * Add info into the info shard
   * @param {object} obj 
   */
  async addInfo(obj) {
    await this.set('info', obj.id, obj.info);
  }

  /**
   * Remove info from the info shard
   * @param {object} obj 
   */
  async removeInfo(obj) {
    const prefix = this.prefix(obj.id);
    if (this.memory.info?.[prefix]?.[obj.id]) {
      delete this.memory.info[prefix][obj.id];
      this.markDirty('info', prefix);
    }
  }
  

  /**
   * Adds or updates an object into memory eg {id: 'wol', name: 'Wolis', loc: '2'}
   * @param {object} obj 
   */
  async save(obj, old) {
    // console.log(`${this.app.name} save`, obj, 'old', old);
    const className = this.classNameWords(obj);
    if (old) {
      const oldClassName = this.classNameWords(old);
      if (obj.loc !== old.loc) {
        await this.removeLoc(old.loc, old.id);
      }
      if (className !== oldClassName) {
        await this.removeName(oldClassName, old.id);
      }
      if (obj.code !== old.code) {
        await this.removeCode(old);
      }
      if (obj.info !== old.info) {
        await this.removeInfo(old);
      }
    }

    await this.set('id', obj.id, obj);
    await this.addLoc(obj.loc, obj.id);
    await this.addName(this.classNameWords(obj), obj.id);
    if (obj.code) {
      await this.set('code', obj.id, {loc: obj.loc, code: obj.code});
    }
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
    for ( const word of this.classNameWords(obj)) {
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

  async debounceSave() { 
    // Clear any existing timer
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Set a new 5-second timer
    this.saveTimeout = setTimeout(async () => {
      console.log(`${this.app.name} @@ timeout debounce save to disk`);
      this.saveTimeout = null;
      await this.saveToDisk();
    }, this.interval);
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

  /**
   * Combines class and name then splits into words
   * TODO: will add extra and prefix words too, amd exclude common 'called', 'named', 'of' etc..
   * @param {object} obj 
   * @returns 
   */
  classNameWords(obj) {
    let className = obj.class;
    if (obj.name) {
      className += ` ${obj.name}`;
    }
    return className.split(' ');
  }

}
