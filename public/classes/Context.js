import { Cowmands } from './Cowmands.js';

export class Context {
  counter = 0; // counter for next IDs
  seed = 1; // seed for consistent random numbers based on this.ts
  subs = {};

  constructor(app, context) {
    // expand the context into this object eg: this.ts = context.ts;
    Object.assign(this, context);
    this.app = app;
    this.prepRandom(this.ts);
    this.cowmands = new Cowmands(this.app, this);
  }

  /**
   * Each context gets a unique id being the timestamp + the actor id
   * @returns {string}
   */
  key() {
    return `${this.ts}${this.actor}`;
  }

  /**
   * Entry point for processing this context
   */
  async process() {
    // Each context carries the counter from the client that created it;
    // sync up so our counter never falls behind any peer's.
    this.app.id.sync(this.counter);
    if (this.app.seen(this.key())) return;
    if (!this.cmd) return;
    // same player then remember the last 'it'
    if (this.actor === this.app.player.info.id) {
      this.app.player.info.it = this.it;
    }
    console.log(`\n${this.app.name} ### processing:`, this.ts, this.actor, 'loc:', this.loc, 'counter:', this.app.id.counter, 'it:', this.it, this.cmd);
    const { firstword, rest } = this.app.utils.splitFirstWord(this.cmd);
    this.cowmand = firstword;
    this.rest = rest;
    this.cmd_text = rest;
    const code = await this.app.db.findCommand(this);
    if (!code) {
      this.msg = `[${this.actor}] tries to ${this.cmd}, but nothing happens`;
      await this.app.ui.addMessage(this);
      this.app.ui.hideLoading();
      return;
    };
    await this.runCodeFrom(code, '__start');
    this.app.ui.hideLoading();

  }

  /**
 * Sets up the context to run the code from the block
 * @param {string} code 
 * @param {string} block 
 */
  async runCodeFrom(code, block) {
    // Partition cowscript code into sub-blocks
    this.partitionCode(code);
    // Execute from __start
    await this.runSub(block);
  }

  /**
   * Partitions the cowscript code by ## into subs 
   * @param {string} code 
   */
  partitionCode(code) {
    // Split on ##
    // We prefix with ##__start: to catch the initial statement
    const blocks = ('##__start:' + code).split('##');
    for (const block of blocks) {
      if (!block.trim()) continue;
      const colonIndex = block.indexOf(':');
      if (colonIndex !== -1) {
        const subName = block.substring(0, colonIndex).trim();
        const subContent = block.substring(colonIndex + 1).trim();
        this.subs[subName] = subContent;
      }
    }
  }

  /**
 * Executes a subroutine block line-by-line (semicolon separated)
 * @param {string} subName
 */
  async runSub(subName) {
    const subContent = this.subs[subName];
    if (!subContent) {
      return;
    }
    const statements = subContent.split(';');
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (!trimmedStatement) continue;
      await this.executeStatement(trimmedStatement);
    }
  }

  /**
 * Executes a single statement
 * @param {string} statement 
 */
  async executeStatement(statement) {
    console.log(`${this.app.name} -- executeCowmand [${statement}]`);
    const trimmed = statement.trim();
    if (!trimmed) return;

    let { firstword, rest } = this.app.utils.splitFirstWord(trimmed);

    // Flexible handling for variable assignments without the "var" keyword
    // e.g. `$prefix to (sweetly, nicely)` -> rewritten as `var $prefix to ...`
    if (firstword.startsWith('$')) {
      rest = `${firstword} ${rest}`;
      firstword = 'var';
    }

    const handler = this.cowmands.statementList[firstword.toLowerCase()];
    if (handler) {
      // Pass the remaining string
      await handler(rest);
    } else {
      console.warn(`No handler found for statement keyword: "${firstword}"`);
    }
  }

  /**
   * Sets the seed for our psudo random number generator
     {"ts":1786020193429,"actor":"wol","loc":"2","cmd":"aa 001"}
   * from the context timestamp eg 
   * 
   * @param {int} seed 
   */
  prepRandom(seed) {
    this.seed = seed >>> 0; // unsigned 32-bit
  }

  /**
   * Generate a random number form 0 to max eg 0 - 10
   * useing mulberry32
   * @param {int} max 
   * @returns {int}
   */
  random(max = 1) {
    // Mulberry32 step
    this.seed |= 0;
    this.seed = this.seed + 0x6D2B79F5 | 0;

    let t = Math.imul(this.seed ^ this.seed >>> 15, 1 | this.seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    const rand = ((t ^ t >>> 14) >>> 0) / 4294967296;

    return Math.floor(rand * max);
  }


}