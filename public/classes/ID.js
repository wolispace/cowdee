/**
 * Generate sequential IDs starting at 0 and incrementing in base62 or whatever we have set the alphabet to be
 * The 16,777,216th object will be id '9999' so plenty of growth wile taking up very little space 
 */
export class ID {
  counter = 1; // first object is 1, anything without a loc is in the void (id=0)
  // if alphabet is 62 char long then we are doing base62 encoding
  alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  chunkSize = 500; // how many objects per file
  chunkLength = 2; // how many chars in the chunk c0_cz or c00_czz 

  constructor(app) {
    this.app = app;
    // Note: load() is async — call it via await in App.start(), not here
  }

  /**
   * Fetch the current counter from the server on startup so we never
   * start from 1 after a test rebuild or a fresh tab open.
   * Awaited by App.start() before any objects are created.
   */
  async load() {
    try {
      const result = await this.app.io.fetchJson('server', { lastContext: this.app.lastContext || '0' });
      if (result?.counter) {
        this.sync(result.counter);
      }
    } catch (e) {
      // non-fatal: stay at counter = 1
    }
  }

  /**
   * Sync the in-memory counter up to the server's known highest value.
   * Called on startup (load) and on every incoming context (Context.process).
   * @param {number|string} serverCounter
   */
  sync(serverCounter) {
    const val = parseInt(serverCounter, 10);
    if (!isNaN(val) && val > this.counter) {
      this.counter = val;
    }
  }

  /**
   * Create a new ID — sequential number encoded in base62.
   * The counter is sent to the server with every batch/file save via IO,
   * so server.php keeps _counter.txt current automatically.
   * @returns {string}
   */
  new() {
    this.counter++;
    return this.encodeInt(this.counter);
  }

  // encode the interger into base 62 (or whatever the aphabet is long)
  encodeInt(num) {
    const base = this.alphabet.length;

    // Special case for zero
    if (num === 0) return this.alphabet[0];

    // Compute number of digits directly
    const digits = Math.floor(Math.log(num) / Math.log(base)) + 1;

    let str = "";
    let placeValue = Math.pow(base, digits - 1);

    for (let i = 0; i < digits; i++) {
      const digit = Math.floor(num / placeValue);
      str += this.alphabet[digit];
      num = num % placeValue;
      placeValue = placeValue / base;
    }

    return str;
  }

  // decode the interger out of base 62 (or whatever the aphabet is long)
  decodeInt(str) {
    const base = this.alphabet.length;
    let num = 0;

    for (let i = 0; i < str.length; i++) {
      const digit = this.alphabet.indexOf(str[i]);
      if (digit < 0) throw new Error("Invalid character in base-N string");
      num = num * base + digit;
    }

    return num;
  }


  /** NOT USED:
   * Pad with lowest value so all ids/keys have the same min length 
   * eg "F" becomes "F0" if we are chunking with 2 character so ends up in index_name_F0_Fz.json
   * Sme logic works for base62 encoded ints, no need to decode. 
   * @param {string} str 
   * @returns {string}
   */
  normalize(str) {
    const padChar = this.alphabet[0]; // lowest char
    return str.padEnd(this.keyLength, padChar);
  }


/** NOT USED:
 * Converts an integer OR base62 string into a chunked filename.
 * chunkSize = number of prefixes per chunk (NOT number of objects)
 * chunkLength = number of characters in the prefix (e.g. 2 → "F0_Fz")
 */
chunkFilename(id) {

    // 1. Convert id to a base62 string if needed
    let encoded = typeof id === "number"
        ? encodeInt(id)
        : id; // already encoded

    // 2. Normalize to prefix length
    const prefix = encoded.padEnd(this.chunkLength, this.alphabet[0])
                         .slice(0, this.chunkLength);

    // 3. Convert prefix → integer index
    const prefixIndex = this.decodeInt(prefix);

    // 4. Determine chunk number
    const chunkNumber = Math.floor(prefixIndex / this.chunkSize);

    // 5. Compute chunk start/end prefix indexes
    const startIndex = chunkNumber * this.chunkSize;
    const endIndex   = startIndex + this.chunkSize - 1;

    // 6. Convert back to base62 prefixes
    const start = encodeInt(startIndex).padStart(this.chunkLength, this.alphabet[0]);
    const end   = encodeInt(endIndex).padStart(this.chunkLength, this.alphabet[0]);

    return `${start}_${end}`;
}


};

