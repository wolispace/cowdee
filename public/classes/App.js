import { Storage } from './Storage.js';
import { Utils } from './Utils.js';
import { SSE } from './SSE.js';
import { IO } from './IO.js';
import { UI } from './UI.js';
import { DB } from './DB.js';
import { ID } from './ID.js';
import { Player } from './Player.js';
import { LookManager } from './LookManager.js';
import { Context } from './Context.js';

const LAST_CONTEXT_KEY = 'lastContext'; // how we local store the last seen context key

export class App {
  lastContext = '0'; // last seen context.key
  tickTimersInitialized = false;
  serverOffset = 0;
  tickConfigs = {};
  tickWatchdog = null;

  constructor(options = {}) {
    this.window = (typeof window !== "undefined");
    this.local = this.window && window.location.hostname === 'localhost';
    this.quickLogin = false;

    this.settings = options.settings || { generate: false, max: 5 };
    this.name = this.settings.name || 'cowdee';
    this.webroot = this.getWebroot();

    this.storage = new Storage(this);
    this.utils = new Utils(this); // random utils
    this.io = new IO(this); // disk IO - read and write to server
    this.ui = new UI(this); // user interface
    this.db = new DB(this); // database - read and write objects
    this.id = new ID(this); // generate unique sequential ids
    this.player = new Player(this);
    this.lookManager = new LookManager(this);

    // ui elements with click commands will execute these:
    this.clickCmds = {
      examine: el => `examine ${el.dataset.id}`,
      close: () => `look`,
      doorway: el => `go ${el.dataset.id}`,
      paint: el => `paint ${el.dataset.id} ${el.dataset.color}`,
      run: el => `${el.dataset.id}`

    };
  }

  async start() {
    this.lastContext = this.storage.getItem(LAST_CONTEXT_KEY) || '0';
    await this.id.load(); // Node: reads disk; Browser: fetches server counter
    await this.player.load();

    // start the SSE now we know the last context seen
    if (!this.settings.nosse) {
      this.sse = new SSE(this);
      console.log('starting SSE');
      await this.sse.connect();
    }

    if (this.window) {
      // universal form submit we pass to the handler for forms
      document.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const data = Object.fromEntries(new FormData(form));
        data.button = event.submitter?.value;
        await this.handleForm(data);
        const cmdInput = document.getElementById('cmd');
        if (cmdInput) {
          cmdInput.value = '';
          cmdInput.focus();
        }
      });

      /**
       * Universal click handler to examine or go through doorways etc..
       */
      document.querySelector('content').addEventListener('click', async (event) => {
        const el = event.target.closest('.click');
        if (!el) return;
        const cmd = this.clickCmds[el.dataset.cmd];
        if (cmd) {
          await this.sendCommand(cmd(el));
        } else {
          const thisCmd = el.dataset.cmd.replace(/{id}/, el.dataset.id);
          await this.sendCommand(thisCmd);
        }
      });
    }

  }

  wakePlayer() {
    console.log('wake player');
  }

  // returns this font-rne js or node script communicates with
  getWebroot() {
    if (!this.window) {
      // return 'http://localhost:8880'; 
      return 'http://localhost';
    } else {
      return new URL('.', window.location.href).toString();
    }
  }

  /**
   * Have we already seen/processed this context (save in storage if we havent)
   * @param {string} key 
   * @returns {boolean}
   */
  seen(key) {
    if (this.lastContext >= key) {
      return true;
    }
    //console.log(`setting lastContext to ${key}`);
    this.lastContext = key;
    this.storage.setItem(LAST_CONTEXT_KEY, this.lastContext);
    return false;
  }

  /**
   * send multiple commands eg: 'create a cup. paint it red. put it on the table';
   * @param {string} commands 
   */
  async sendCommands(commands) {
    for (const cmd of commands.split('.')) {
      await this.sendCommand(cmd.trim());
    }
  }
  /**
   * Sends one context to the server then processes all of the contexts it gets back (this being one of them)
   * {actor:'wol', loc:'2', cmd: 'look', lastContext: '2928192827392wol', counter: 5}
   * @param {object} data 
   */
  async sendCommand(data) {
    this.player.editing = false;
    if (!data.ts) {
        this.ui.showLoading();
    }
    if (typeof data === 'string') {
      data = { cmd: data };
    }
    // every command sent needs and actor, loc, it, lastContext, counter
    data.actor = data.actor ?? this.player.id;
    data.loc = data.loc ?? this.player.loc;
    data.it = this.player.it;
    data.lastContext = this.lastContext;
    data.counter = this.id.counter;
    if (data.cmd && data.saveHistory !== false && !data.cmd.startsWith('::run')) {
      this.player.addHistory(data.cmd);
    }
    const result = await this.io.fetchJson('server', data);
    if (result?.contexts) {
      const contexts = typeof result.contexts === 'string' ? JSON.parse(result.contexts) : result.contexts;
      await this.processContexts(contexts);
    }
  }

  /**
   * Processes each of the array of basic context values [{actor:'wol', loc:'2', cmd: 'look'}]
   * @param {array} contexts 
   */
  async processContexts(contexts) {
    for (const rawContext of contexts) {
      if (rawContext?.ts) {
        this.syncTime(rawContext.ts);
      }
      rawContext.app = this; // stuff the app into the context object
      const context = new Context(this, rawContext);
      await context.process();
    }
  }

  // forms dont need to fetch anymore, as the data is in memory (or fetch to fill memory)
  async handleForm(data) {
    if (data.type === 'login') {
      await this.player.handleLogon(data);
    } else if (data.type == 'checkpw') {
      await this.player.handleCheckPw(data);
    } else if (data.type == 'newplayer') {
      await this.player.handleNewPlayer(data);
    } else if (data.type == 'cmd') {
      await this.sendCommand(data);
    } else if (['code', 'info'].includes(data.type)) {
      if (data.button === 'cancel') {
        // cancel edit and sent 'look'
        data.cmd = 'look';
      } else {
        data.cmd = this.buildSaveCommand(data);
      }
      console.log('saving code', data);
      await this.sendCommand(data);
    }
  }

  buildSaveCommand(data) {
    let encoded = this.utils.encodeString(data.val);
    let cmd = `::run set ${data.id}'s ${data.type} to "${encoded}";`;
    cmd += `relook $actor's loc;`;
    cmd += `say 'edit',"[$actor] finishes with [${data.id}]";`;
    return cmd;
  }

  /**
   * Synchronizes server time from context timestamp and initializes tick timers if needed.
   * @param {number} serverTs
   */
  syncTime(serverTs) {
    if (typeof serverTs !== 'number' || isNaN(serverTs)) return;
    this.serverTs = serverTs;
    this.serverOffset = serverTs - Date.now();
    if (!this.tickTimersInitialized) {
      this.initTickTimers();
    }
  }

  /**
   * Returns current synchronized timestamp based on server truth
   * @returns {number}
   */
  getCurrentTs() {
    return Date.now() + this.serverOffset;
  }

  /**
   * Initializes the 3 timers aligned to server time:
   * - every 20 seconds at :00, :20, :40 (tick — also runs ##tickloc: sub-block)
   * - every hour at 00:05 (5 mins after the hour, tickhour)
   * - every day at 00:10 (10 mins after midnight, tickday)
   */
  initTickTimers() {
    if (this.tickTimersInitialized) return;
    this.tickTimersInitialized = true;

    // Static schedule — the key is the tick type passed to runTick.
    // Runtime state (type, timerId, targetTs, lastRunBoundary) is injected below.
    this.tickConfigs = {
      tick:     { period: 20 * 1000,           phase: 0 },
      tickhour: { period: 60 * 60 * 1000,      phase: 5 * 60 * 1000  }, // 5 mins into the hour
      tickday:  { period: 24 * 60 * 60 * 1000, phase: 10 * 60 * 1000 }, // 10 mins after midnight
    };

    for (const [type, config] of Object.entries(this.tickConfigs)) {
      config.type = type;
      config.timerId = null;
      config.targetTs = 0;
      config.lastRunBoundary = 0;
      this.scheduleTick(config);
    }

    if (this.window && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden') {
          this._lastHidden = Date.now();
        } else if (document.visibilityState === 'visible') {
          await this.refreshTickTimers();
        }
      });
      // Note: 'focus' intentionally omitted — visibilitychange covers tab-return.
    }

    // Watchdog: check every 10s to recover from background throttling / sleep
    this.tickWatchdog = setInterval(() => this.checkTickTimers(), 10000);
  }

  /**
   * Returns the last elapsed boundary timestamp for a tick config — deterministic and identical across all browsers.
   * e.g. for period=20s, phase=0: always a multiple of 20s since epoch
   */
  tickBoundary(config) {
    const now = this.getCurrentTs();
    const currentMod = ((now % config.period) + config.period) % config.period;
    const distancePastPhase = ((currentMod - config.phase) + config.period) % config.period;
    return now - distancePastPhase;
  }

  /**
   * Schedules next occurrence for a given tick config aligned to synchronized server time
   */
  scheduleTick(config) {
    if (config.timerId) {
      clearTimeout(config.timerId);
      config.timerId = null;
    }

    const now = this.getCurrentTs();
    const currentMod = ((now % config.period) + config.period) % config.period;
    let delay = (config.phase - currentMod) % config.period;
    if (delay <= 0) delay += config.period;

    config.targetTs = now + delay;
    config.timerId = setTimeout(async () => {
      config.timerId = null;
      const boundary = this.tickBoundary(config);
      config.lastRunBoundary = boundary;
      try {
        await this.runTick(config.type, boundary);
      } catch (err) {
        console.error(`[App] Error executing tick ${config.type}:`, err);
      }
      this.scheduleTick(config);
    }, delay);
  }

  /**
   * Checks if any tick timer target was missed while backgrounded/sleeping.
   * Re-entrant safe: if already running (slow sendCommand in-flight) it exits immediately.
   */
  async checkTickTimers() {
    if (!this.tickConfigs || this._checkingTicks) return;
    this._checkingTicks = true;
    try {
      const now = this.getCurrentTs();
      for (const config of Object.values(this.tickConfigs)) {
        if (config.targetTs && now >= config.targetTs + 1000) {
          const boundary = this.tickBoundary(config);
          if (boundary === config.lastRunBoundary) continue; // already ran this boundary
          if (config.timerId) {
            clearTimeout(config.timerId);
            config.timerId = null;
          }
          config.lastRunBoundary = boundary;
          try {
            await this.runTick(config.type, boundary);
          } catch (err) {
            console.error(`[App] Error in overdue tick ${config.type}:`, err);
          }
          this.scheduleTick(config);
        }
      }
    } finally {
      this._checkingTicks = false;
    }
  }

  /**
   * Refreshes and realigns all tick timers (called on tab-visible).
   * checkTickTimers handles overdue ticks and reschedules them;
   * we then schedule any that are still waiting to keep them aligned.
   */
  async refreshTickTimers() {
    console.log(`${this.name} refreshing tick timers...`);
    const elapsed = Date.now() - (this._lastHidden ?? Date.now());
    if (elapsed > 60_000) {
      // Away long enough that memory may be stale — save pending writes then re-read fresh
      console.log(`${this.name} tab was hidden for ${Math.round(elapsed / 1000)}s, flushing memory...`);
      await this.db.flush();
    }
    if (!this.tickTimersInitialized || !this.tickConfigs) return;
    await this.checkTickTimers();
    // Reschedule any that weren't overdue (their timerId was left in place by checkTickTimers)
    for (const config of Object.values(this.tickConfigs)) {
      if (!config.timerId) this.scheduleTick(config);
    }
    await this.player.relook();
  }

  /**
   * Stops all tick timers and watchdog
   */
  stopTickTimers() {
    if (this.tickWatchdog) {
      clearInterval(this.tickWatchdog);
      this.tickWatchdog = null;
    }
    if (this.tickConfigs) {
      for (const key of Object.keys(this.tickConfigs)) {
        if (this.tickConfigs[key].timerId) {
          clearTimeout(this.tickConfigs[key].timerId);
          this.tickConfigs[key].timerId = null;
        }
      }
    }
    this.tickTimersInitialized = false;
  }

  /**
   * Executes a tick of given type: tick, tickhour, tickday
   * Each reacting object sends a command with the deterministic boundary ts as its own id,
   * making the server filename {boundary}{id}.json identical across all browsers.
   * @param {string} type
   * @param {number} boundaryTs  - the tick boundary timestamp (same in every browser)
   */
  async runTick(type, boundaryTs) {
    if (!this.player?.id) return;
    // Don't fire ticks while the tab is hidden — refreshTickTimers catches up on return
    if (this.window && document.visibilityState === 'hidden') return;
    const ids = await this.db.get(type, '__');
    if (!ids || ids.length === 0) return;

    for (const id of ids) {
      const obj = await this.db.get('id', id);
      if (!obj) continue;
      const code = await this.db.getCode(id);
      if (!code) continue;
      await this.sendCommand({
        ts: boundaryTs,
        actor: id,
        loc: obj.loc,
        cmd: `::tick ${type}`,
        saveHistory: false
      });
    }
  }
}

