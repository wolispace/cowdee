export class Context {
  seed = 1;

  constructor(context) {
    // expand the context into this object eg: this.ts = context.ts;
    Object.assign(this, context);
    this.prepRandom(this.ts);
    //  
  }

  key() {
    return `${this.ts}${this.actor}`;
  }

  process() {
    if (this.app.seen(this.key())) return;
    console.log('processing ', this.ts, this.actor, this.loc, this.cmd);
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