import { SetMap } from './SetMap.js';

// a pool that loads from disk as needed and write out at intervals
// this manages one pool so multiple poolManagers are needed for id, name, loc etc..
export class PoolManager {
  type = ''; // type of pool 'id' 'name' etc..
  pool = new SetMap(); // pool of currently being interacted with objects
  dirtyUpdated = new Set(); // all of the modified objects
  dirtyDeleted = new Set(); // all of the deleted objects

  /**
   * A pool manager you get and set into which loads and saves to a base62 shard file eg 'index_name_D.json' 
   * (assume linux with case sensitive filenames)
   * @param {object} app  
   * @param {string} type - what this pool is storing: ids, names, code, locations etc..?
   */
  constructor(app, type = 'id') {
    this.app = app;
    this.type = type;
  }

  /**
   * Does the object exist in the pool?
   * @param {any} key 
   * @returns {boolean} 
   */
  has(key) {
    return this.pool.has(key);
  }

  /**
   * Helper to populate the pool with all items inside a loaded shard
   */
  populateFromShard(items) {
    if (!items || typeof items !== 'object') return;
    for (const [key, value] of Object.entries(items)) {
      for (const item of value) {
        this.pool.add(key, item);
      }
    }
  }

  /**
   * Returns the object matching the key from the pool or add it into the pool from shard file on disk
   * @param {string} key 
   * @returns {object}
   * 
   */
  async get(key) {
    if (key === undefined || key === null || key === '') return;
    // console.log(`get[${key}]`);
    if (this.pool.has(key)) return this.pool.get(key);
    const filename = this.app.io.makeShardFilename(this.type, key);
    const items = await this.app.io.loadJson(filename);
    this.populateFromShard(items);
    return this.pool.get(key);
  }

  /**
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
   * Add/update the object with its ID to the pool
   * if oldKey is set, that key and its contents gets deleted
   * if override is set we replace the value of key with ONLY the new thing (1:1 mapping)
   * @param {string} key 
   * @param {object} thing 
   * @param {string} oldKey
   * @param {boolean} override 
   */
  async set(key, thing, oldKey = null) {
    if (this.app.utils.isObject(thing)) {
      // 1:1 mapping: replace entirely with a single-element Set
      this.pool.replace(key, new Set([thing]));
    } else {
      if (!this.pool.has(key)) {
        await this.get(key);
      }
      this.pool.set(key, thing);
    }
    this.dirtyUpdated.add(key);
    this.app.db.anyDirty = true;
    // remove from the previous key eg was in loc:A now in loc:B
    // if loc is empty then flag it as deleted
    if (!oldKey || oldKey === key) return;
    if (!this.pool.has(oldKey)) {
      await this.get(oldKey);
    }
    const isEmpty = this.pool.deleteValue(oldKey, thing);
    if (isEmpty) {
      // console.log(`delete old loc=${oldKey} id=${thing} isEmpty=`, isEmpty);
      this.dirtyDeleted.add(oldKey);
          this.app.db.anyDirty = true;
    } else {
      this.dirtyUpdated.add(oldKey);
          this.app.db.anyDirty = true;
    }
  }

  /**
   * Delete either a string from the set eg remove "Ax" from {cat:["Ax","5Rd"], card: ["EdQ"]}
   * Or delete the entire object {Ax:{id:"Ax", class:"cat"}, 5Rd: {id:5Rd, class:"cat"}, "card": {id:EdQ, class="card"}, }
   * If moving from one loc to anther{id:A, loc:B} => {id:A, loc:C} we delete A from C, so we should flag this as dirty and deleted not just delete it
   * @param {string} key 
   * @param {string|object} thing 
   * @returns 
   */
  delete(key, thing) {
    const existing = this.pool.get(key);
    if (existing) {
      if (thing === undefined || thing === null) {
        this.pool.delete(key);
        this.dirtyDeleted.add(key);
            this.app.db.anyDirty = true;
      } else {
        existing.delete(thing);
        this.dirtyUpdated.add(key);
            this.app.db.anyDirty = true;
      }
    }
  }

  /**
   * Clears everything from this pool
   */
  clear() {
    this.pool.clear();
  }

  /**
   * Returns true if either update or delete is dirty
   * @returns {boolean}
   */
  isDirty() {
    return this.pool.isDirty();
    //return (this.dirtyUpdated.size > 0 || this.dirtyDeleted.size > 0);
  }


  /**
   * Collects all dirty shard updates and deletions into the batch map without reading from disk/server first
   * @param {object} batch 
   */
  collectDirty(batch) {
    if (!this.isDirty()) return;
    console.log(`${this.app.name} collectDirty:`, this.type, this.app.utils.getImmediateCaller());

    // Group updated keys by shard file
    for (const prefix of this.pool.dirtyUpdated) {
      const filename = this.app.io.makeShardFilename(this.type, prefix);
      batch[filename] = this.pool.getShard(prefix);
    }
    // Group deleted keys by shard file
    for (const prefix of this.pool.dirtyDeleted) {
      const filename = this.app.io.makeShardFilename(this.type, prefix);
      batch[filename] = this.pool.getShard(prefix);
    }

    // // Apply changes directly to batch map without loading over HTTP
    // for (const [filename, { updated, deleted }] of files) {
    //   let json = batch[filename] || this.pool.getShard(prefix);

    //   // Apply deletions
    //   for (const key of deleted) {
    //     delete json[key];
    //   }

      // // Apply updates
      // for (const key of updated) {
      //   let poolValue = this.pool.get(key);
      //   if (poolValue instanceof Set) {
      //     poolValue = [...poolValue]; // convert into an array
      //   }
      //   json[key] = poolValue;
      //   // // refresh pool with this content..
      //   // const item = new Set(json?.[key] ?? undefined);
      //   // this.pool.set(key, item);
      // }

    //  batch[filename] = json;

    console.log(`${this.app.name} dirty batch`, batch);

    this.pool.dirtyUpdated.clear();
    this.pool.dirtyDeleted.clear();
  }

  /**
   * Saves the dirty pool in a batch
   * @returns 
   */
  async saveDirty() {
    if (!this.isDirty()) return;
    const batch = {};
    this.collectDirty(batch);
    if (Object.keys(batch).length > 0) {
      await this.app.io.saveBatch(batch);
    }
  }

  toJson() {
    return this.pool.toJson();
  }

  getShard(prefix) {
    return this.pool.getShard(prefix);
  }

}