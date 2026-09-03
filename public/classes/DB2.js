export class DB2 {

  memory = {};

  /*
  memory = { 
    name: {
      H: {house: ["2"]},
      L: {library: ["3"]},
      B: {basket: ["2a","B2"], bob: ["bob"], build: ["Dw"]},
      J: {jane: ["jan"]},
    },
    id: {
      2: {2: {id:2, name:"house", loc: "0"}, 2a: {id:2a, name:"basket", loc: "2"}},
      3: {3: {id:3, name:"library", loc: "0"}},
      D: {Dw: {id:Dw, name:"build", loc: "3"}},
      J: {jan: {id:jan, name:"jane", loc: "3"}},
      B: {bob: {id:bob, name:"bob", loc: "2"}, B2: {id:B2, name:"basket", loc: "3"}},
    },
    loc: {
      2: {2: [2a, bob]},
      3: {3: [jan, B2]},
    },
    code: {
      D: {Dw: {loc:3, code: "get $text\nnew $text;"}
    },
    info: {
      D: {Dw: "Use this command to build new locations."},
      B: {B2: "Its a rather special basket"}
    }
  }
 

  */

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
  get(type, key) {
    const prefix = this.prefix(key);
    // only ID is mixed case so we can find things like name in mixed case
    if (type !== 'id') key = key.toLowerCase();
    if (!this.memory[type][prefix]) {
      this.memory[type][prefix] = this.io.loadJson(`${type}_${prefix}`);
    };
    return this.memory[type][prefix][key];
  }

  /**
   * Writs into memory the value for this type and key
   * @param {string} type 
   * @param {string} key 
   * @param {any} value 
   */
  set(type, key, value) {
    const prefix = this.prefix(key);
    // only ID is mixed case so we can find things like name in mixed case
    if (type !== 'id') key = key.toLowerCase();

    // Ensure shard is loaded
    let shard = this.memory[type][prefix];
    if (!shard) {
      shard = this.io.loadJson(`${type}_${prefix}`);
      this.memory[type][prefix] = shard;
    }

    shard[key] = value;
  }


  /**
   * Returns the first latter of the key eg 'w' forom 'wolis'
   * in production we return the ascii value eg '65' for 'A'
   * But DEBUG just uppercases the value from easy of finding things
   * @param {string} key 
   * @returns {string}
   */
  prefix(key = '') {
    return key[0].toUpperCase();
  }

  // manipulate objects within each type/prefix/key

  /**
   * Adds an object into memory eg {id: 'wol', name: 'Wolis', loc: '2'}
   * @param {object} obj 
   */
  add(obj) {
    // --- ID shard ---
    this.set('id', obj.id, obj);

    // --- NAME shard ---
    // TODO: build name from class and name 
    // loop through all words and add to the 'name' list
    const word = obj.name
    const nameKey = word.toLowerCase();
    const nameList = this.get('name', nameKey) ?? [];
    nameList.push(id);
    this.set('name', nameKey, nameList);

    // --- LOC shard ---
    const locList = this.get('loc', obj.loc) ?? [];
    locList.push(id);
    this.set('loc', obj.loc, locList);

    // --- CODE shard ---
    if (obj.code) {
      const codeList = this.get('code', obj.code) ?? {};
      codeList[obj.id] = {loc: obj.loc, code: obj.code};
      this.set('loc', loc, locList);
    }
   // --- INFO shard ---
    if (obj.info) {
      const infoList = this.get('info', obj.info) ?? {};
      infoList[obj.id] = obj.info;
      this.set('loc', loc, locList);
    }

  }

  /**
   * Moves object into the new location
   * @param {string} id 
   * @param {string} newLoc 
   * @returns 
   */
  move(id, newLoc) {
    const obj = this.get('id', id);
    if (!obj) return;

    const oldLoc = obj.loc;

    // --- Remove from old location ---
    const oldList = this.get('loc', oldLoc) ?? [];
    const filtered = oldList.filter(x => x !== id);
    this.set('loc', oldLoc, filtered);

    // --- Add to new location ---
    const newList = this.get('loc', newLoc) ?? [];
    newList.push(id);
    this.set('loc', newLoc, newList);

    // --- Update object itself ---
    obj.loc = newLoc;
    this.set('id', id, obj);
  }

  /**
   * Remove the object from the existance
   * @param {string} id 
   * @returns 
   */
  remove(id) {
    const obj = this.get('id', id);
    if (!obj) return;

    const { name, loc } = obj;

    // --- Remove from ID shard ---
    const prefix = this.prefix(id);
    const idShard = this.memory.id[prefix];
    delete idShard[id];

    // --- Remove from NAME shard ---
    const nameKey = name.toLowerCase();
    const nameList = this.get('name', nameKey) ?? [];
    this.set('name', nameKey, nameList.filter(x => x !== id));

    // --- Remove from LOC shard ---
    const locList = this.get('loc', loc) ?? [];
    this.set('loc', loc, locList.filter(x => x !== id));

    // --- Remove from CODE chard ---
    const codeList = this.get('code', obj.code) ?? {};
    delete codeList[id];

  }

  /**
   * Renames an object
   * @param {string} id 
   * @param {string} newName 
   * @returns 
   */
  rename(id, newName) {
    const obj = this.get('id', id);
    if (!obj) return;

    const oldNameKey = obj.name.toLowerCase();
    const newNameKey = newName.toLowerCase();

    // --- Remove from old name list ---
    const oldList = this.get('name', oldNameKey) ?? [];
    this.set('name', oldNameKey, oldList.filter(x => x !== id));

    // --- Add to new name list ---
    const newList = this.get('name', newNameKey) ?? [];
    newList.push(id);
    this.set('name', newNameKey, newList);

    // --- Update object ---
    obj.name = newName;
    this.set('id', id, obj);
  }

}
