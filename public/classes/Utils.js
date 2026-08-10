
/**
 * This class holds a bunch of random utilities everyone can enjoy
 */
export class Utils {

  /**
   * Removes wrapping quotes from the string eg '"hello"' becomes: 'hello'
   * - will work with enything like {hello} or [hello]
   * - will clobber unquoted strings so hello becomes ell 
   * @param {string} msg 
   * @returns {string}
   */
  trimQuotes(msg) {
    return msg.substring(1, msg.length - 1);
  }

  isString(v) {
    return typeof v === "string" || v instanceof String;
  }

  isObject(v) {
    return v !== null && typeof v === "object" && !this.isString(v);
  }

  /**
   * Splits off the first word, leaving the rest
   * @param {string} whole 
   * @returns {firstword, rest, whole}
   */
  splitFirstWord(whole) {
    const trimmed = whole.trim();
    const spaceIndex = trimmed.indexOf(' ');
    let firstword = spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex);
    let rest = spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1).trim();
    return { firstword, rest };
  }

   
  /**
   * Replace all key in {} with their value eg "Hi {w}" + {w: "wolis"} = "Hi wolis"
   * @param {string} content 
   * @param {object} params 
   * @returns {string} 
   */
  replaceParams(content, params) {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? '');
  }

  /**
   * Returns the data.msg, with all {key} replaced with value from data.objs[key].prop values
   * eg objs['w'] = {class: cat, pose: 'sleeping'}
   * "{w.class} says hi." becomes "wolis says hi"
   * 
   * @param {object} data 
   * @param {boolean} paintext 
   * @returns 
   */
  interpolate(data, paintext = false) {
    if (data.msg) {
      // Interpolate object templates: {ID} (defaults to longname) or {ID.attribute}
      data.msg = data.msg.replace(/\{(\w+)(?:\.(\w+))?\}/g, (match, id, attr) => {
        const obj = data.objs?.[id];
        if (!obj) return match;

        const prop = attr || 'longname';
        let val = obj[prop] !== undefined ? obj[prop] : '';

        // Special handling if the player/actor matches the object ID (e.g. 'w' -> wolis)
        if (prop === 'longname' && data.context && id === data.context.player) {
          val = `${obj.name} (you)`;
        }
        if (paintext) {
          return val;
        }

        // Format value with styling if color is defined
        const color = obj.color;
        let styled = val;
        if (color && val !== '') {
          styled = `<span style="color: ${color}">${val}</span>`;
        }

        // Wrap in clickable link if object is linkable

        return `<a href="#" class="obj-link" data-id="${val}" title="Examine ${val}">${styled}</a>`;
        return styled;
      });

      data.msg = data.msg.replace(/\s+/g, ' ').trim();
    }

    return this.capitalEachSentence(data.msg);
  }

  // Brute force assume everything after ". " needs to be capitalised
  capitalEachSentence(text) {
    return text.replace(/\.\s*([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);
  }

  // not used yet, maybe a smarter thing to use than capitalEachSentence()
  sentenceCaseString(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Returns the calling function for debugging purposes only
   * @returns {string}
   */
  getImmediateCaller() {
    const originalFunc = Error.prepareStackTrace;
    // Override the stack formatter to return structured call sites
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    const stack = err.stack;
    // Restore the original formatter
    Error.prepareStackTrace = originalFunc;
    // stack[0] is getImmediateCaller
    // stack[1] is the function that called getImmediateCaller
    // stack[2] is the parent/immediate caller you are looking for
    if (stack && stack[2]) {
      return stack[2].getFunctionName() || 'anonymous';
    }
    return 'unknown';
  }

}

