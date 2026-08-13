import { SetMap } from './SetMap.js';

export class LookManager {
  seen = [];
  found = {};
  objs = {};
  groups = new SetMap();
  seen = new Set();
  sentences = [];
  sentenceCounter = 0;
  objCounter = 0;
  maxPerGroup = 2;

  constructor(app) {
    this.app = app;
  }

  get db() {
    return this.app.db;
  }

  /**
   * Returns an object for adding to the msg queue with a list of all obj
   * @param {object} context 
   */
  async list(context) {
    this.context = context;
    this.sentences = [];
    
    const loc = await this.db.getById(this.context.loc);
    if (!loc) {
      this.sentences.push('Nothing interesting here');
      return this.returnData();
    }
    this.found = await this.db.findInLoc(loc.id);

    this.sentences = [`In {${loc.id}} you see: `];
    if (!this.found || this.found.size < 1) {
      this.sentences.push('Nothing interesting here');
      return this.returnData();
    }

    this.objs = await this.populateObjs();
    this.objs[loc.id] = loc;
    let list = '';
    for (const id of this.found) {
      list += `<li>{${id}}</li>`;
    }
    this.sentences.push(list);
    return this.returnData();
  }

  /**
   * Returns an object for adding to the msg queue with a paragraph of all obj
   * @param {object} context 
   */
  async look(context) {
    this.seen = new Set();
    this.groups = new SetMap();
    this.sentenceCounter = 0;
    this.context = context;
    this.sentences = [];
    this.objs = {};
    if (!this.context.loc) {
      console.log('There is nothing to see as you are nowhere', context);
      this.sentences.push('You are nowhere');
      return this.returnData();
    }
    let loc = await this.db.getById(this.context.loc);
    if (!loc) {
      loc = await this.db.getById(0);
    }
    if (loc) {
      this.db.formatObject(loc);
    }
    if (!loc) {
      this.sentences.push('You are nowhere');
      return this.returnData();
    }
    this.found = await this.db.findInLoc(loc.id);
    // console.log(`found in ${loc.id}`, this.found);
    const inon = 'in';
    this.sentences = [`You are ${inon} {${loc.id}}`];
    if (!this.found || this.found.size < 1) {
      this.sentences.push('Nothing interesting here');
      if (loc) this.objs[loc.id] = loc;
      return this.returnData();
    }
    this.objs = await this.populateObjs();
    this.hosted = this.buildHosted();
    // console.log(this.hosted.entries);
    // console.dir(this.hosted, { depth: null, colors: true });
    const unhosted = this.hosted['_'];
    if (unhosted) {
      this.recursiveLook(unhosted);
    }
    // console.dir(this.groups, { depth: null, colors: true });
    this.buildSentences();
    if (loc) this.objs[loc.id] = loc;
    // console.log(this.sentences);
    return this.returnData();
  }

  /**
   * Returns a list of all visible objects 
   * @returns {object}
   */
  async populateObjs() {
    const objs = {};
    for (const id of this.found) {
      const obj = await this.db.getById(id);
      if (!obj || obj.pose == 'hidden') continue;
      objs[id] = obj;
      this.db.formatObject(objs[id]);
    }
    return objs;
  }

  /**
   * Returns an object grouped by hosting, hosthow and pose so sentences can be structued by these
   * @returns {object}
   */
  buildHosted() {
    const hosted = {};
    for (const [id, obj] of Object.entries(this.objs)) {
      const key = obj.host ?? '_';
      const sub = obj.hosthow ?? '_';
      const pose = obj.pose ?? '_';
      if (!hosted[key]) hosted[key] = {};
      if (!hosted[key][sub]) hosted[key][sub] = {};
      if (!hosted[key][sub][pose]) hosted[key][sub][pose] = [];

      hosted[key][sub][pose].push(id);
      // console.log(key, sub, pose, id);
    }
    return hosted;
  }

  /**
   * Puts all objects into groups for formatting into setences
   * @param {*} hosthows 
   */
  recursiveLook(hosthows) {
    // hosthows is always an object:
    // { on: { _: [...], flying: [...] }, under: {...}, ... }
    for (const [hosthow, poses] of Object.entries(hosthows)) {
      // poses is an object of pose → ids[]
      // { _: ['1'], flying: ['H'] }
      for (const [pose, ids] of Object.entries(poses)) {
        for (const id of ids) {
          if (this.seen.has(id)) continue;
          this.groups.set(this.sentenceCounter, id);
          this.seen.add(id);
          const hosted = this.hosted[id];
          if (!hosted) continue;
          this.sentenceCounter++;
          // hosted[id] is again hosthows
          this.recursiveLook(hosted);
          // this.incrementCount();
        }
        this.sentenceCounter++;
      }
      this.sentenceCounter++;
    }
  }

  /**
   * Format sentences as replaceable params for display 
   */
  buildSentences() {
    let sentenceCount = 0;
    let lastHost = '';
    for (const [key, ids] of this.groups.map) {
      const firstId = ids.values().next().value; // read first from a Set
      const obj = this.objs[firstId];
      const host = obj?.host;
      let showHost = '</div><div>You also see';
      if (host) {
        if (lastHost == host) {
          showHost = `{${obj.id}.hosthow} the {${host}.class} there {${obj.id}.is}`;
        } else {
          showHost = `{${obj.id}.hosthow} the {${host}.class} there {${obj.id}.is}`;
        }
      }
      let sentence = sentenceCount++ < 1 ? 'You see' : showHost;
      let delim = ' ';
      let objCounter = 1;
      for (const id of ids) {
        const sub = this.objs[id];
        delim = (ids.size > 1 && objCounter++ >= ids.size) ? ' and ' : delim;
        let objName = ['player','command'].includes(sub.class) ? `${sub.class} called {${id}}` : `{${id}.plural}`;
        let descObj = `{${id}.pose} {${id}}`;
        descObj = `{${id}.qtyText} {${id}.pose} ${objName}`;
        sentence += `${delim}${descObj}`;
        delim = ', ';
      }
      this.sentences.push(sentence);
      lastHost = obj.id;
    }
  }

  /**
   * Returns a data structure sor sening as a message to the front-end
   * @returns {object}
   */
  returnData() {
    return {
      msg: '<div>' + this.sentences.join('. ') + '</div>',
      loc: this.context.loc,
      top: true, // this message replaces the top section if true
    };
  }
};
