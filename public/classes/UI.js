// handles the splitter UI with scrollable panels top and bottom
export class UI {
  dragging = false;
  startY = 0;
  startTopH = 0;
  startBottomH = 0;
  splitRatio = null; // null = use CSS flex defaults; 0–1 = top's share after drag
  messages = [];
  topView = '';

  constructor(app) {
    this.app = app;
    if (!window) return;
    this.splitter = document.getElementById('splitter');
    this.panels = document.getElementById('panels');
    this.top = document.getElementById('top');
    this.bottom = document.getElementById('bottom');
    this.input = document.getElementById('input');
    this.minHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--section-min-height')) * parseFloat(getComputedStyle(document.documentElement).fontSize);

    this.setupEvents();
    this.initDialog();
  }

  async addMessage(context) {
    // if its not in the players location, or its to the player or loc is all then dont show
    if (!context) {
      console.trace(`${this.app.name} no context passed in`);
      return;
    }
    if (!context.loc) {
      console.trace(`${this.app.name} no loc in context`, context);
      return;
    }

    if (context.loc != this.app.player.info.loc) {
      console.log(`${this.app.name} --- msg not shown`, context.loc, context.actor, context.msg.slice(0, 30));
      return;
    }

    // set the last target so we can refer to it as 'it' or 'them'
    if (context?.target) {
      this.app.player.info.lastt = context.target;
    }

    // DEBUG: If the user simply includes 'logoff' in the msg then logoff - make a propper command later
    if (context?.msg?.includes('logoff')) {
      this.app.player.clear();
      this.showDialog('You have logged off<form><menu><button class="buttonize">Ok</button></menu></form>', () => { this.app.ui.closeDialog() });
      return;
    }
    context.playerId = this.app.player.info.id;

    if (!window) {
      context.msg = await this.expand(context, 'text');
      if (context.msg) {
        this.messages.push(context.msg);
        if (context.top) {
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
      div.innerHTML = context.msg;
      if (context.top) {
        info.replaceChildren(div);
        // auto-scroll top for new look around
        // TODO: only scroll if the current scroll position is at the bottom before appending the content
        info.scrollTop = 0;
      } else {
        info.appendChild(div);
        // auto-scroll bottom to newest content
        // TODO: only scroll if the current scroll position is at the bottom before appending the content
        info.scrollTop = info.scrollHeight;
      }
    }
  }

  /**
   * Expand the [id] and [id.prop] templates in the message to the actual object names or attributes
   * @param {object} context 
   * @param {string} format 
   * @returns 
   */
  async expand(context, format = 'html') {
    if (context.msg) {
      const matches = [...context.msg.matchAll(/\[(\w+)(?:\.(\w+))?\]/g)];

      // make a list of all referenced object IDs for quick reference
      const loadedObjs = {};
      for (const match of matches) {
        const id = match[1];
        if (!loadedObjs[id]) {
          loadedObjs[id] = await this.app.db.getById(id);
        }
      }

      context.msg = context.msg.replace(/\[(\w+)(?:\.(\w+))?\]/g, (match, id, attr) => {
        const obj = loadedObjs[id];
        if (!obj) return `??${id}??`;
        this.app.db.formatObject(obj);

        const prop = attr || 'longname';
        let val = obj[prop] !== undefined ? obj[prop] : '';

        // Special handling if the player/actor matches the object ID (e.g. 'w' -> wolis)
        if (prop === 'longname' && id === context.playerId) {
          val = `${obj.name} (you)`;
        }
        // TODO: something in the context dictates "a bus" or "the bus"
        // if (['pus','drop','pose','paint'].includes(context.context.trigger)) {
        //   val = `the ${obj.longname}`;
        // }
        if (!['longname', 'name', 'shorname', 'plural'].includes(prop)) {
          return val;
        }
        if (format == 'html') {
          // Format value with styling if color is defined
          const color = obj.color;
          let styled = val;
          if (color && val !== '') {
            styled = `<span style="color: ${color}">${val}</span>`;
          }
          return `<a href="#" class="obj-link" data-id="${id}" title="Examine ${val} [${id}]">${styled}</a>`;
        } else {
          return val;
        }
      });
      context.msg = context.msg.replace(/\s+/g, ' ').trim();
    }
    context.msg = this.capitalEachSentence(context.msg);
    return context.msg;
  }

  capitalEachSentence(text) {
    return text.replace(/\.\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);
  }



  /**
   * initlialises the dialog, linking the element as a dialog
   */
  initDialog() {
    this.dialogElement = document.getElementById("dialog");
    this.dialogElement.addEventListener("close", () => {
      if (this.closeCallback) {
        this.closeCallback(this.dialogElement.returnValue);
      }
    });
  }

  /**
   * Adds the html content on the dialog and shows it
   * Attaches the callback to run when the dialog is closed
   * @param {string} html 
   * @param {function} closeCallback 
   */
  showDialog(html, closeCallback = () => { }) {
    this.closeCallback = closeCallback;
    if (this.dialogElement) {
      this.dialogElement.addEventListener("close", this.closeCallback);
      this.dialogElement.innerHTML = html;
      this.dialogElement.showModal();
    }
  }

  /**
   * Closes the dialog
   */
  closeDialog() {
    if (this.dialogElement) {
      this.dialogElement.close();
    }
  }


  /** Redistribute top/bottom within #panels based on the stored ratio */
  applySplitRatio() {
    if (this.splitRatio === null) return; // CSS flex handles it before any drag
    const available = this.panels.getBoundingClientRect().height - this.splitter.getBoundingClientRect().height;

    let topH = available * this.splitRatio;
    let bottomH = available * (1 - this.splitRatio);

    // enforce minimums
    if (topH < this.minHeight) { topH = this.minHeight; bottomH = available - this.minHeight; }
    if (bottomH < this.minHeight) { bottomH = this.minHeight; topH = available - this.minHeight; }

    this.top.style.flex = `0 0 ${topH}px`;
    this.bottom.style.flex = `0 0 ${bottomH}px`;
  };

  /**
   * Attach event listners to things that need them
   */
  setupEvents() {
    this.splitter.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.startY = e.clientY;
      this.startTopH = this.top.getBoundingClientRect().height;
      this.startBottomH = this.bottom.getBoundingClientRect().height;
      this.splitter.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    this.splitter.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dy = e.clientY - this.startY;
      let newTopH = this.startTopH + dy;
      let newBottomH = this.startBottomH - dy;

      // enforce minimums
      if (newTopH < this.minHeight) {
        newTopH = this.minHeight;
        newBottomH = this.startTopH + this.startBottomH - this.minHeight;
      }
      if (newBottomH < this.minHeight) {
        newBottomH = this.minHeight;
        newTopH = this.startTopH + this.startBottomH - this.minHeight;
      }

      this.top.style.flex = `0 0 ${newTopH}px`;
      this.bottom.style.flex = `0 0 ${newBottomH}px`;
    });

    this.splitter.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.splitter.releasePointerCapture(e.pointerId);
      // store ratio so resizes stay proportional
      const topH = this.top.getBoundingClientRect().height;
      const bottomH = this.bottom.getBoundingClientRect().height;
      this.splitRatio = topH / (topH + bottomH);
    });

    this.splitter.addEventListener('pointercancel', (e) => {
      this.dragging = false;
    });

    // ── Proportional resize when viewport changes (keyboard, window resize) ──
    new ResizeObserver(() => {
      if (!this.dragging) this.applySplitRatio();
    }).observe(this.panels);
  }

  // set a timeout of 500ms to animate this.top opacity from current (usually 0%) to 50% opacity over a 500ms period. 
  showLoading() {
    if (!window) return;
    this.loading = setTimeout(() => {
      this.top.style.opacity = '0.25';
    }, 500);
  }

  // clear this.loading timeout if present 
  // if this.top opacity is > 0% then fade it to 0% over250ms.
  hideLoading() {
    if (!window) return;
    if (this.loading) {
      clearTimeout(this.loading);
      this.loading = null;
    }
    if (this.top.style.opacity > 0) {
      this.top.style.opacity = '1';
    }
  }
};
