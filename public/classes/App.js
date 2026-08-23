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

if (typeof window === "undefined") {
  global.window = false;
}

export class App {
  lastContext = '0'; // last seen context.key
  
  constructor(options = {}) {
    this.settings = options.settings || { generate: false, max: 5 };
    this.webroot = this.getWebroot();
    
    this.storage = new Storage(this, options.namespace || '0');
    this.utils = new Utils(this); // random utils
    this.io = new IO(this); // disk IO - read and write to server
    this.ui = new UI(this); // user interface
    this.db = new DB(this); // database - read and write objects
    this.id = new ID(this); // generate unique sequential ids
    this.player = new Player(this);
    this.lookManager = new LookManager(this);
  }
  
  async start() {
    this.lastContext = this.storage.getItem(LAST_CONTEXT_KEY) || '0';
    await this.id.load();
    await this.player.load();
    
    // start the SSE now we know the last context seen
    if (!this.settings.nosse) {
      this.sse = new SSE(this);
      console.log('starting SSE');
      await this.sse.connect();
    }

    if (typeof document !== 'undefined') {
      // universal form submit we pass to the handler for forms
      document.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const data = Object.fromEntries(new FormData(form));
        // set essential values
        data.actor = this.player.info.id;
        data.loc = this.player.info.loc;
        this.handleForm(data);
        const cmdInput = document.getElementById('cmd');
        if (cmdInput) cmdInput.value = '';
      });
    }
  }

  wakePlayer() {
    console.log('wake player');
  }

  // returns this font-rne js or node script communicates with
  getWebroot() {
    if (!window) {
      return 'http://localhost:8880/public'; // 'http://localhost';
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
   * Sends one context to the server then processes all of the contexts it gets back (this being one of them)
   * {actor:'wol', loc:'2', cmd: 'look', lastContext: '2928192827392wol', counter: 5}
   * @param {object} data 
   */
  async sendCommand(data) {
    if (typeof data === 'string') {
      data = { cmd: data };
    }
    data.actor = data.actor ?? this.player.info.id;
    data.loc = data.loc ?? this.player.info.loc;
    data.lastContext = this.lastContext;
    data.counter = this.id.counter;
    const result = await this.io.fetchJson('server', data);
    if (result?.contexts) {
      const contexts = JSON.parse(result.contexts);
      await this.processContexts(contexts);
    }
  }

  /**
   * Processes each of the array of basic context values [{actor:'wol', loc:'2', cmd: 'look'}]
   * @param {array} contexts 
   */
  async processContexts(contexts) {
    for (const rawContext of contexts) {
      rawContext.app = this; // stuff the app into the context object
      const context = new Context(this, rawContext);
      await context.process();
    }
  }

  // forms dont need to fetch anymore, as the data is in memory (or fetch to fill memory)
  async handleForm(data) {
    if (data.type === 'login') {
      await this.player.handleLogon(data);
    } else {
      await this.sendCommand(data);
    }
  }
}

