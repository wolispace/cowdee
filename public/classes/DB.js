// handles the memory pools
import { PoolManager } from './PoolManager.js'

export class DB {
  pools = {};
  keys = ['id', 'name', 'code', 'loc', 'trigger', 'info'];
  dir = '_db';
  interval = 5_000;
  saveTimeout = null;
  anyDirty = false; // set by pools to true the moment one pool is dirty, clear after save


  constructor(app) {
    this.app = app;

    for (const key of this.keys) {
      this.pools[key] = new PoolManager(this.app, key);
    }
  }

  /**
   * Flush all objects from all pools
   */
  flush() {
    for (const key of this.keys) {
      this.pools[key].clear();
    }
    this.app.storage?.clear();
  }

  /**
   * console log the contents of the pools
   */
  dump() {
    for (const key of this.keys) {
      console.log(`pool ${key}`, this.pools[key].pool.entries());
    }
  }


  /**
   * Returns the whole object from a chunked file
   * @param {string} id 
   * @returns {object}
   */
  async getById(id) {
    const set = await this.pools.id.get(id);
    if (!set || set.size === 0) return undefined;
    const obj = set.values().next().value;
    return obj;
  };

  async getFormattedById(id) {
    const obj = await this.getById(id);
    if (obj) {
      this.formatObject(obj);
      return obj;
    }
  }

  /**
   * Returns an array of IDs with the required word eg: "cat" returns ["AB", "Ax" ...]
   * @param {string} key 
   * @returns {set} of IDs with this name
   */
  async findByName(key) {
    const name = key.replace(/^(?:the|an|a)\b/i, '').trim().toLocaleLowerCase();
    return await this.pools.name.get(name);
  };

  /**
   * Return the obj of the player matching the name
   * TODO: worry about passwords later
   * @param {object} data with data.username and data.pw
   * @returns {object}
   */
  async findPlayer(data) {
    const candidates = await this.pools.name.get(data.playername.toLocaleLowerCase());
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
    if (!inName || inName.size === 0) return undefined;
    if (loc == 'all') {
      return inName.values().next().value;
    }

    const inLoc = await this.findInLoc(loc);
    if (!inLoc) return undefined;
    for (const key of inLoc) {
      if (inName.has(key)) {
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
    return await this.pools.loc.get(key);
  }

  findMatchInLoc(obj, context) {
    // TODO: for creating a new object that merges with an existing
    // loop through all objects in the location and if they match the obj.class, obj.color etc..
    // then return it else return null
  }

  /**
   * Retruns the code for the object.id passed in
   * for consistancy, even tho its just a string, its stored in an array with one element
   * @param {id} id 
   * @returns {string}
   */
  async getCode(id) {
    const set = await this.pools.code.get(id);
    if (!set || set.size === 0) return '';
    const codeObj = set.values().next().value;
    return codeObj?.code ?? '';
  };

    /**
   * Retruns the info for the object.id passed in
   * for consistancy, even tho its just a string, its stored in an array with one element
   * @param {id} id 
   * @returns {string}
   */
  async getInfo(id) {
    const set = await this.pools.info.get(id);
    if (!set || set.size === 0) return '';
    const infoObj = set.values().next().value;
    return infoObj?.info ?? '';
  };

  /**
   * Find the first named command (look in player then location then globaly so long as its a command)
   * "find" means look for it somewhere, where as "get" means we know it so get it.
   * @param {string|object} firstword 
   * @param {object} [context] 
   * @returns {string} return the code from the bext match object
   */
  async findCommand(firstword, context) {
    let cowmand = '';
    let ctx = null;
    if (typeof firstword === 'object') {
      ctx = firstword;
      cowmand = ctx.cowmand;
    } else {
      cowmand = firstword;
      ctx = context || {};
    }

    const ids = await this.findByName(cowmand);

    if (!ids || ids.size < 1) return '';
    if (ids.size === 1) {
      const [id] = ids;
      return await this.getCode(id);
    }
    for (const id of ids) {
      const obj = await this.getById(id);
      if (!obj) continue;
      if (obj.loc === ctx.actor) {
        return await this.getCode(id);
      }
      if (obj.loc === ctx.loc) {
        return await this.getCode(id);
      }
      if (obj.class === 'command') {
        return await this.getCode(id);
      }
    }
    return '';
  };

  /**
   * Runs code from a triggered object
   * @param {object} context 
   * @returns 
   */
  async findTrigger(context) {
    if (!context) return;
    const found = await this.pools.trigger.get(context.trigger);
    if (!found || found.size < 1) return;
    // loop through these to see if they are in the context.loc
    const inLoc = await this.pools.loc.get(context.loc);
    if (!inLoc || inLoc.size < 1) return;
    const triggerable = new Set(
      [...found].filter(obj => inLoc.has(obj.id))
    );

    if (triggerable.size < 1) return;

    // dont do infinate reactions
    if (this.reactions++ >= this.maxReactions) return;

    for (const triggered of triggerable) {
      const obj = await this.getById(triggered.id);
      if (!obj) continue;
      // prepare the context for this execution
      context.actor = obj.id;
      obj.code = await this.getCode(obj.id);
      await this.app.commandManager.runCodeFrom(obj.code, triggered.block, context);
    }
  }

  /**
   * Add the object to all of the pools updaing and old pools
   * @param {obj} obj 
   * @param {object} old 
   */
  async save(obj, old) {
    // if there is already an obj, we maybe changing existing values like its loc from one to another
    // so clear from all pools
    if (obj.code) {
      await this.pools.code.set(obj.id, { id: obj.id, loc: obj.loc, code: obj.code }, null, true);
      await this.addTriggers(obj);
      delete obj.code; // const { code, ...rest } = obj; // delete obj.code using destructuring
    }
    if (obj.info) {
      await this.pools.info.set(obj.id, obj.info, null, true);
      delete obj.info; // delete const { info, ...rest } = obj; // delete obj.info using destructuring
    }
    this.formatObject(obj);
    await this.pools.id.set(obj.id, obj, null, true);
    const oldLongName = `${old?.class ?? ''} ${old?.name ?? ''}`.trim().toLowerCase();
    const objLongName = `${obj?.class ?? ''} ${obj?.name ?? ''}`.trim().toLowerCase();

    if (oldLongName != objLongName) {
      for (const name of objLongName.split(' ').filter(Boolean)) {
        await this.pools.name.set(name, obj.id);
      }
    }
    if (!old || obj.loc !== old.loc) {
      await this.pools.loc.set(obj.loc, obj.id, old?.loc);
    }
    this.app.db.debounceSave();
  }

  /**
   * Adds a trigger word if this code is triggred in some way
   * @param {object} obj 
   * @returns 
   */
  async addTriggers(obj) {
    // combined
    const pattern = /\bif\s+(reacting\s+to|target\s+of)\s+(\w+)\s+then\s+(\w+);/i;
    const match = obj.code.match(pattern);
    if (!match) return;
    const type = match[1].includes('target') ? 'target' : 'reacts';
    const trigger = match[2];
    const block = match[3];
    await this.pools.trigger.set(trigger, { id: obj.id, block: block });
  }

  /**
   * Write to disk all of the changed pools in a single batch
   */
  async savePoolsToDisk() {
    console.log('--- savePoolsToDisk ---');
    // this.anyDirty = false;
    if (!await this.app.io.tryLock()) return;
    const batch = {};
    for (const pool of Object.values(this.pools)) {
      pool.collectDirty(batch);
    }
    if (Object.keys(batch).length > 0) {
      await this.app.io.saveBatch(batch);
    }
    await this.app.io.unLock();
  }


  /**
   * Add all referenced objects into this context from "{Ax} says hi to {b2}"
   * @param {object} data 
   * @returns nothing, updates obj
   */
  async prepContext(data) {
    data.objs = data.objs ?? {};

    // Phase 1: Process [$var] (bracketed = linkable objects)
    const matches1 = [...data.msg.matchAll(/\[\$(\w+)\]/g)];
    for (const m of matches1) {
      const varName = m[1];
      const value = data.context[varName] ?? '';
      const obj = await this.getById(value);
      if (obj) {
        data.objs[value] = { id: obj.id, loc: obj.loc, name: obj.name, longname: obj.longname, color: obj.color, link: true };
      }
    }
    data.msg = data.msg.replace(/\[\$(\w+)\]/g, (_, varName) => {
      const value = data.context[varName] ?? '';
      return data.objs[value] ? `{${value}}` : value;
    });

    // Phase 2: Process $var (non-bracketed = styled but not linked)
    const matches2 = [...data.msg.matchAll(/\$(\w+)/g)];
    for (const m of matches2) {
      const varName = m[1];
      const value = data.context[varName] ?? '';
      const obj = await this.getById(value);
      if (obj && !data.objs[value]) {
        data.objs[value] = { longname: obj.longname, color: obj.color };
      }
    }
    data.msg = data.msg.replace(/\$(\w+)/g, (_, varName) => {
      const value = data.context[varName] ?? '';
      return data.objs[value] ? `{${value}}` : value;
    });

    if (data.brief) {
      for (const obj of Object.values(data.objs)) {
        obj.longname = `the ${obj.class}`;
        console.log(obj.longname);
      }
    }
  }

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

  /**
   * New lookLoc2 method that structures descriptions dynamically and recursively
   * with limits on sentence group size and rotating templates.
   * @param {Context} context 
   * @returns {Context}
   */
  async lookLoc(context) {
    const data = await this.app.lookManager.look(context);
    // messageManager.add(data);
    return data;
  }

  debounceSave() {
    // Clear any existing timer
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Set a new 5-second timer
    this.saveTimeout = setTimeout(async () => {
      if (this.anyDirty) {
        console.log('timeout debounce savePools');
        this.saveTimeout = null;
        await this.savePoolsToDisk();
      }
    }, this.interval);
  }
}
