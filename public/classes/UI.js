// handles the splitter UI with scrollable panels top and bottom


export class UI {
  dragging = false;
  startY = 0;
  startTopH = 0;
  splitRatio = null; // null = use CSS flex defaults; 0–1 = top's share after drag
  messages = [];
  topView = '';
  loadingCount = 0;
  loadingTimer = null;
  hideTimer = null;
  loadBar = null;


  constructor(app) {
    this.app = app;
    if (!this.app.window) return;
    this.splitter = document.getElementById('splitter');
    this.panels = document.getElementById('panels');
    this.top = document.getElementById('top');
    this.bottom = document.getElementById('bottom');
    this.input = document.getElementById('input');
    this.cmdInput = document.getElementById('cmd');
    this.loadBar = document.getElementById('load-bar');
    const secMin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--section-min-height')) || 2;
    const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    this.minHeight = secMin * rootFs;

    this.setupEvents();
    this.initDialog();
    this.initHistory();

    this.bottom.style.flex = '1 1 0';
    this.bottom.style.minHeight = '0';
    this.bottom.innerHTML = `<br/><br/>`;
    this.bottom.addEventListener('click', () => {
      this.cmdInput.focus();
    });

    // When the tab regains focus, clear any unread '*' indicator from the title
    window.addEventListener('focus', () => {
      document.title = document.title.replace(/\*$/, '');
    });
  }

  async addMessage(context) {
    // if its not in the players location, or its to the player or loc is all then dont show
    if (!context) return;
    if (!context.loc) {
      console.trace(`${this.app.name} no loc in context`);
      return;
    }
    setTimeout(async () => {
      await this.app.db.findTrigger(context);
    }, 300);

    if (!context.to){
      // its not to anyone so check the location
      if (context.loc != this.app.player.loc) {
        console.log(`${this.app.name} --- msg not in same loc and not to anyone. to:`, context.to, context.msg.slice(0, 30));
        return;
      }
      // we show msg
    } else {
      // its to someone
      if (!['all', 'loc', this.app.player.id].includes(context.to)) {
        console.log(`${this.app.name} --- msg not for all/loc or this player. to:`, context.to, context.msg.slice(0, 30));
        return;
      }
    }

    // DEBUG: If the user simply includes 'logoff' in the msg then logoff - make a propper command later
    // TODO: universal force logoff simply needs to check msg and not worry about player id
    if (context?.msg?.includes('logoff') && context.actor === this.player.id) {
      this.app.player.clear();
      this.app.player.welcome();
      return;
    }
    context.playerId = this.app.player.id;

    if (!this.app.window) {
      context.msg = await this.expand(context, 'text');
      if (context.msg) {
        this.messages.push(context.msg);
        if (context.top) {
          if (this.app.player.editing) return;
          this.topView = context.msg;
        }
      }
      console.log(`${this.app.name} --- addMsg node: `, context.msg);
      return context.msg;
    }

    context.msg = await this.expand(context, 'html');

    if (context.msg) {
      const div = document.createElement("div");
      const section = context.top ? '#top' : '#bottom';
      const info = document.querySelector(section);
      if (context.top) {
        div.innerHTML = context.msg;

        info.replaceChildren(div);
        // auto-scroll top for new look around
        // TODO: only scroll if the current scroll position is at the bottom before appending the content
        info.scrollTop = 0;
      } else {
        div.innerHTML = context.msg;
        info.appendChild(div);
        // auto-scroll bottom to newest content
        // TODO: only scroll if the current scroll position is at the bottom before appending the content
        info.scrollTop = info.scrollHeight;
      }
      this.blinkTitle(1000);
    }
  }

  /**
   * Flashes a '*' on and off in the tab title for the given duration to signal
   * a new message has arrived. Settles with '*' if the tab is unfocused, or
   * without if it has focus.
   *
   * @param {number} duration  Total animation time in milliseconds (default 500).
   * @param {number} tickMs    How fast '*' toggles on/off (default 100ms).
   */
  blinkTitle(duration = 500, tickMs = 100) {
    // Cancel any in-progress animation so overlapping calls restart cleanly
    if (this._blinkTimer) {
      clearInterval(this._blinkTimer);
      this._blinkTimer = null;
    }

    const original = document.title.replace(/\*$/, '');
    const end = Date.now() + duration;
    let shown = false;

    this._blinkTimer = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(this._blinkTimer);
        this._blinkTimer = null;
        // Settle: keep '*' only if the tab is still unfocused
        const unfocused = document.visibilityState === 'hidden' || !document.hasFocus();
        document.title = original + (unfocused ? '*' : '');
        return;
      }
      shown = !shown;
      document.title = original + (shown ? '*' : '');
    }, tickMs);
  }

  /**
   * Expand the [id] and [id.prop] templates in the message to the actual object names or attributes
   * @param {object} context 
   * @param {string} format 
   * @returns 
   */
  async expand(context, format = 'html') {
    console.log(`${this.app.name} expand() `, context);
    if (context.msg) {
      // dont expand if we are showing an edit form
      if (context.msg.includes('<form')) return context.msg;
      const matches = [...context.msg.matchAll(/\[(\w+)(?:\.(\w+))?\]/g)];
      const defaultProp = context.top ? 'longname' : 'thename';
      // make a list of all referenced object IDs for quick reference
      const loadedObjs = {};
      for (const match of matches) {
        const id = match[1];
        if (!loadedObjs[id]) {
          loadedObjs[id] = await this.app.db.getById(id);
        }
      }
      for (const match of matches) {
        const [token, id, attr] = match;
        const obj = loadedObjs[id];
        const replacement = await this.expandToken(obj, id, attr, defaultProp, context, format);
        context.msg = context.msg.replace(token, replacement);
      }
      context.msg = context.msg.replace(/\s+/g, ' ').trim();
    }
    context.msg = context.msg.replace(/<p>\s*([a-z])/g, (_, letter) => `<p>${letter.toUpperCase()}`);
    return context.msg;
  }

  async expandToken(obj, id, attr, defaultProp, context, format) {
    if (!obj) return ` (can't find id=${id}) `;
    this.app.db.formatObject(obj);
    const prop = attr || defaultProp;
    let val = obj[prop] !== undefined ? obj[prop] : '';
    if (['longname', 'thename'].includes(prop) && id === context.playerId) val = `${obj.name ?? obj.class} (you)`;
    if (!['thename', 'longname', 'name', 'shorname', 'class'].includes(prop)) return val;
    if (obj.extra) val = `${val} ${obj.extra.trim()}`;
    if (format !== 'html') return val;

    let cmd = 'examine', hint = 'Examine';
    let showloc = '';
    if (obj.link) {
      cmd = 'doorway'; hint = 'Go';
      showloc = await this.seeThroughDoorway(context, obj);
    }
    if (/book|newspaper|magazine/.test(obj.class)) { cmd = 'read'; hint = 'Read'; }
    if (context.cmd && context.cmd != '') { cmd = context.cmd; hint = `Choose this to ${context.cmd}`; }

    // Build the span that looks like this
    // <span class="click ${locked}" data-cmd="${cmd}" ${style} data-id="${id}" title="${hint} ${val} ${id}">${val}</span>${showloc}
    const span = document.createElement('span');
    span.className = `click${obj.lock ? ' locked' : ''}`;
    span.dataset.cmd = cmd;
    span.dataset.id = id;
    span.title = `${hint} ${val} ${id}`;
    span.textContent = val;
    if (obj.color) span.style.color = obj.color;

    // return the outerHTML so it slots into the existing string-replace flow
    return span.outerHTML + showloc;
  }

  async seeThroughDoorway(context, obj) {
    if (!context.top) return '';
    let showloc = '';
    const linked = await this.app.db.getById(obj.link);
    if (linked.loc !== obj.id) {
      const newloc = await this.app.db.getById(linked.loc);
      showloc = ` (through this you can see a ${newloc.class}) `;
    }
    return showloc;
  }

  /**
   * Find all 'type: [...]' with a click to execute the command
   * @param {string} msg 
   * @returns {string} 
   */
  makeClickLinks(msg) {
    const matches = [...msg.matchAll(/type: \[(.+?)\]/g)];

    for (const match of matches) {
      const cmd = match[1];
      msg = msg.replace(`type: [${match[1]}]`, `<span class="click suggest" data-cmd="run" title="Click to perform this command as if you had typed it" data-id="${match[1]}">${match[1]}</span>`);
    }
    return msg;
  }

  async initMenu() {
    let html = `<strong>Distributed COW</strong>
    <p>If it all goes terribly wrong, reload your browser.<p>`;
    html += await this.app.lookManager.readText({target:'_6'});
    this.app.menu(html);
  }

  /**
   * initlialises the dialog, linking the element as a dialog
   */
  initDialog() {
    this.dialogElement = document.getElementById("dialog");
    this.dialogElement.addEventListener("close", () => {
      if (this.closeCallback) {
        this.closeCallback(this.dialogElement.returnValue);
        document.getElementById('cmd').focus();
      }
    });
  }

  /**
   * Adds the html content on the dialog and shows it
   * Attaches the callback to run when the dialog is closed
   * @param {string} html 
   * @param {function} closeCallback 
   */
  showDialog(html, element, closeCallback = () => { }) {
    this.closeCallback = closeCallback;
    if (this.dialogElement) {
      this.dialogElement.addEventListener("close", this.closeCallback);
      this.dialogElement.innerHTML = html;
      this.dialogElement.showModal();
    }
    document.getElementById(element).focus();
  }

  /**
   * Closes the dialog
   */
  closeDialog() {
    if (this.dialogElement) {
      this.dialogElement.close();
    }
  }

  /**
   * Initializes command history select navigation and keyboard bindings
   */
  initHistory() {
    this.historySelect = document.getElementById('history');
    this.cmdInput = document.getElementById('cmd');
    if (!this.historySelect || !this.cmdInput) return;

    // Open and focus history select on Cursor Up / Down in cmd input
    this.cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const fullHistory = this.app.player.history;
        if (!Array.isArray(fullHistory) || fullHistory.length === 0) return;

        this.draftText = this.cmdInput.value;
        const query = this.draftText.trim().toLowerCase();

        // If user has typed something, filter history by prefix (or contains fallback)
        let filtered = fullHistory;
        if (query) {
          filtered = fullHistory.filter(cmd => cmd.toLowerCase().startsWith(query));
          if (filtered.length === 0) {
            filtered = fullHistory.filter(cmd => cmd.toLowerCase().includes(query));
          }
        }
        if (filtered.length === 0) return;

        e.preventDefault();
        this.historySelect.innerHTML = '';
        filtered.forEach((cmd) => {
          const opt = document.createElement('option');
          opt.value = cmd;
          opt.textContent = cmd;
          this.historySelect.appendChild(opt);
        });

        this.historySelect.size = Math.min(10, Math.max(2, filtered.length));
        // Up starts at latest matching command, Down starts at first
        this.historySelect.selectedIndex = e.key === 'ArrowUp' ? filtered.length - 1 : 0;
        this.cmdInput.value = this.historySelect.value;
        this.historySelect.hidden = false;
        this.historySelect.focus();
      }
    });

    const updateCmdFromSelect = () => {
      if (this.historySelect.value) {
        this.cmdInput.value = this.historySelect.value;
      }
    };

    this.historySelect.addEventListener('change', updateCmdFromSelect);
    this.historySelect.addEventListener('input', updateCmdFromSelect);
    this.historySelect.addEventListener('click', updateCmdFromSelect);
    this.historySelect.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        updateCmdFromSelect();
      }
    });

    // Keyboard navigation inside history select:
    // - Left/Right or Backspace closes select and returns focus to cmd input for editing
    // - Enter executes command and returns focus to cmd input
    // - Escape closes select and restores original typed draft
    this.historySelect.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Backspace') {
        e.preventDefault();
        this.historySelect.hidden = true;
        this.cmdInput.focus();
        const len = this.cmdInput.value.length;
        this.cmdInput.setSelectionRange(len, len);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.historySelect.hidden = true;
        this.cmdInput.focus();
        if (this.input) {
          this.input.requestSubmit();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.historySelect.hidden = true;
        if (this.draftText !== undefined) {
          this.cmdInput.value = this.draftText;
        }
        this.cmdInput.focus();
      }
    });

    // Double-click to execute directly
    this.historySelect.addEventListener('dblclick', () => {
      this.historySelect.hidden = true;
      this.cmdInput.focus();
      if (this.input) {
        this.input.requestSubmit();
      }
    });

    // Close select on blur if focus left both select and cmd input
    this.historySelect.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== this.historySelect && document.activeElement !== this.cmdInput) {
          this.historySelect.hidden = true;
        }
      }, 100);
    });

    // Close select on form submit
    if (this.input) {
      this.input.addEventListener('submit', () => {
        this.historySelect.hidden = true;
      });
    }
  }


  /**
   * Returns the available height inside #panels for top and bottom sections,
   * bounded strictly by the panels container and ensuring it never extends below/behind the input.
   */
  getAvailableHeight() {
    if (!this.panels || !this.splitter) return 0;
    const panelsRect = this.panels.getBoundingClientRect();
    let panelsH = panelsRect.height;

    // Never allow panels area to extend below/behind the fixed input/footer element
    if (this.input) {
      const inputRect = this.input.getBoundingClientRect();
      const maxBottom = Math.min(panelsRect.bottom, inputRect.top);
      panelsH = Math.max(0, maxBottom - panelsRect.top);
    }

    const splitterH = this.splitter.getBoundingClientRect().height;
    return Math.max(0, panelsH - splitterH);
  }

  /** Redistribute top/bottom within #panels based on the stored ratio */
  applySplitRatio() {
    if (this.splitRatio === null) return; // CSS flex handles it before any drag
    const available = this.getAvailableHeight();
    if (available <= 0) return;

    const minH = Math.min(this.minHeight, available / 2);
    let topH = available * this.splitRatio;

    if (topH < minH) topH = minH;
    if (topH > available - minH) topH = available - minH;

    this.top.style.flex = `0 0 ${topH}px`;
    this.bottom.style.flex = '1 1 0';
    this.bottom.scrollTop = this.bottom.scrollHeight;
  }

  /**
   * Attach event listeners to things that need them
   */
  setupEvents() {
    this.splitter.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.startY = e.clientY;
      this.startTopH = this.top.getBoundingClientRect().height;
      this.splitter.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    this.splitter.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const available = this.getAvailableHeight();
      if (available <= 0) return;

      const minH = Math.min(this.minHeight, available / 2);
      const dy = e.clientY - this.startY;
      let newTopH = this.startTopH + dy;

      if (newTopH < minH) newTopH = minH;
      if (newTopH > available - minH) newTopH = available - minH;

      this.top.style.flex = `0 0 ${newTopH}px`;
      this.bottom.style.flex = '1 1 0';
      this.bottom.scrollTop = this.bottom.scrollHeight;
    });

    this.splitter.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.splitter.hasPointerCapture(e.pointerId)) {
        this.splitter.releasePointerCapture(e.pointerId);
      }
      // Store ratio so resizes stay proportional
      const available = this.getAvailableHeight();
      if (available > 0) {
        const topH = this.top.getBoundingClientRect().height;
        this.splitRatio = Math.max(0, Math.min(1, topH / available));
      }
      this.bottom.scrollTop = this.bottom.scrollHeight;
    });

    this.splitter.addEventListener('pointercancel', (e) => {
      this.dragging = false;
      if (this.splitter.hasPointerCapture(e.pointerId)) {
        this.splitter.releasePointerCapture(e.pointerId);
      }
    });

    // ── Proportional resize when viewport changes (keyboard, window resize) ──
    new ResizeObserver(() => {
      if (!this.dragging) this.applySplitRatio();
    }).observe(this.panels);
  }

  // Set a timeout of 100ms to add the .loading class if loading takes longer than 100ms.
  showLoading() {
    if (!this.app.window) return;
    this.loadingCount++;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.loadingCount === 1 && !this.loadingTimer) {
      this.loadingTimer = setTimeout(() => {
        if (this.top) {
          this.top.style.removeProperty('opacity');
          this.top.classList.add('loadFade');
        }
        if (this.loadBar) {
          // Reset bar instantly (no transition), then trigger animation
          this.loadBar.style.transition = 'none';
          this.loadBar.style.width = '0%';
          this.loadBar.style.opacity = '1';
          // Force reflow so the reset takes effect before re-adding class
          void this.loadBar.offsetWidth;
          this.loadBar.style.transition = '';
          this.loadBar.classList.add('grow');
        }
      }, 100);
    }
  }

  // Clear loading state when all pending requests complete (debounced by 80ms to avoid flicker on sequential fetches).
  hideLoading() {
    if (!this.app.window) return;
    if (this.loadingCount > 0) {
      this.loadingCount--;
    }

    if (this.loadingCount === 0) {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (this.loadingCount === 0) {
          if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
          }
          if (this.top) {
            this.top.classList.remove('loadFade');
            this.top.style.opacity = '1';
          }
          if (this.loadBar) {
            // Fade out the bar over 500ms
            this.loadBar.classList.remove('grow');
            this.loadBar.style.opacity = '0';
            // After fade, snap width back to 0 so it's ready for next load
            setTimeout(() => {
              if (this.loadBar) {
                this.loadBar.style.transition = 'none';
                this.loadBar.style.width = '0%';
                void this.loadBar.offsetWidth;
                this.loadBar.style.transition = '';
              }
            }, 500);
          }
        }
      }, 80);
    }
  }


  /**
   * Show msg in browser and add to console log
   * @param {string} msg 
   */
  alert(msg) {
    if (this.app.window) {
      alert(msg);
    }
    console.warn(msg);
  }

  randomColor(randomFunction) {
    const names = this.colorNames();
    return names[randomFunction(names.length)];
  }
  /**
 * Returns a list of known color names sorted by hue
 * @returns {array}
 */
  colorNames() {
    return [
      "red", "darkred", "firebrick", "crimson", "indianred", "lightcoral", "salmon",
      "darksalmon", "lightsalmon", "orangered", "tomato", "coral", "darkorange",
      "orange", "gold", "yellow", "lightyellow", "lemonchiffon", "lightgoldenrodyellow",
      "papayawhip", "moccasin", "peachpuff", "palegoldenrod", "khaki", "darkkhaki",
      "beige", "cornsilk", "blanchedalmond", "bisque", "navajowhite", "wheat", "burlywood",
      "tan", "rosybrown", "sandybrown", "peru", "chocolate", "saddlebrown", "sienna",
      "brown", "maroon",

      "olive", "darkolivegreen", "olivedrab", "yellowgreen", "greenyellow", "chartreuse",
      "lawngreen", "lime", "limegreen", "palegreen", "lightgreen", "mediumspringgreen",
      "springgreen", "mediumseagreen", "seagreen", "forestgreen", "green", "darkgreen",

      "lightseagreen", "darkcyan", "teal", "aqua", "cyan", "lightcyan", "paleturquoise",
      "aquamarine", "turquoise", "mediumturquoise", "darkturquoise",

      "cadetblue", "lightblue", "powderblue", "lightsteelblue", "skyblue", "lightskyblue",
      "deepskyblue", "dodgerblue", "cornflowerblue", "steelblue", "royalblue", "blue",
      "mediumblue", "darkblue", "navy", "midnightblue",

      "indigo", "purple", "darkmagenta", "darkorchid", "blueviolet", "darkviolet",
      "mediumorchid", "orchid", "violet", "plum", "thistle", "magenta", "fuchsia",
      "mediumvioletred", "deeppink", "hotpink", "palevioletred", "lightpink", "pink",

      "rebeccapurple",

      "lavender", "ghostwhite", "aliceblue", "azure", "mintcream", "honeydew", "ivory",
      "seashell", "snow", "floralwhite", "linen", "oldlace", "whitesmoke", "gainsboro",
      "lightgray", "lightgrey", "silver", "darkgray", "darkgrey", "gray", "grey", "dimgray",
      "dimgrey", "slategray", "slategrey", "lightslategray", "lightslategrey",

      "black", "white"
    ];
  }

  /**
   * Returns a list of size names
   * @returns {array}
   */
  sizeNames() {
    return ['tiny', 'small', 'little', 'large', 'big', 'huge', 'giant', 'massive'];
  }


  /**
   * Returns a list of words that map to a quantity number
   * @returns {array}
   */
  qtyNames() {
    return {
      'the': 0,
      'a piece of': 0.5,
      'a part of': 0.5,
      'a section of': 0.5,
      'a': 1,
      'an': 1,
      'another': 1,
      'one': 1,
      'two': 2,
      'three': 3,
      'some': 20,
      'many': 30,
      'innumerable': 50
    };
  }

};
